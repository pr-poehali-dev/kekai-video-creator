"""
Генерация видео из фото и промта через Replicate API (Wan 2.1 image-to-video).
Принимает base64-фото, промт и длительность. Возвращает статус задачи или URL видео.
"""
import json
import os
import boto3
import base64
import urllib.request
import urllib.error

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

REPLICATE_API = "https://api.replicate.com/v1"
MODEL = "wavespeedai/wan-2.1-i2v-480p"


def replicate_request(method, path, data=None):
    token = os.environ["REPLICATE_API_KEY"]
    url = f"{REPLICATE_API}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def upload_video_to_s3(video_url: str, job_id: str) -> str:
    """Скачивает видео с Replicate и загружает в S3, возвращает CDN URL."""
    with urllib.request.urlopen(video_url) as resp:
        video_data = resp.read()

    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    key = f"videos/{job_id}.mp4"
    s3.put_object(Bucket="files", Key=key, Body=video_data, ContentType="video/mp4")
    cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/files/{key}"
    return cdn


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")

    # GET /status?id=xxx — проверка статуса задачи
    if method == "GET":
        params = event.get("queryStringParameters") or {}
        job_id = params.get("id")
        if not job_id:
            return {"statusCode": 400, "headers": HEADERS, "body": json.dumps({"error": "id required"})}

        prediction = replicate_request("GET", f"/predictions/{job_id}")
        status = prediction.get("status")

        if status == "succeeded":
            output = prediction.get("output")
            video_url = output if isinstance(output, str) else (output[0] if output else None)
            if video_url:
                cdn_url = upload_video_to_s3(video_url, job_id)
                return {
                    "statusCode": 200,
                    "headers": HEADERS,
                    "body": json.dumps({"status": "succeeded", "video_url": cdn_url}),
                }

        if status == "failed":
            return {
                "statusCode": 200,
                "headers": HEADERS,
                "body": json.dumps({"status": "failed", "error": prediction.get("error", "unknown")}),
            }

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"status": status}),
        }

    # POST / — запуск генерации
    body = json.loads(event.get("body") or "{}")
    image_b64 = body.get("image")
    prompt = body.get("prompt", "")
    duration = int(body.get("duration", 5))

    if not image_b64 or not prompt:
        return {"statusCode": 400, "headers": HEADERS, "body": json.dumps({"error": "image and prompt required"})}

    # Загружаем исходное фото в S3 и получаем публичный URL
    image_data = base64.b64decode(image_b64.split(",")[-1])
    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    import time
    img_key = f"uploads/{int(time.time() * 1000)}.jpg"
    s3.put_object(Bucket="files", Key=img_key, Body=image_data, ContentType="image/jpeg")
    img_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/files/{img_key}"

    # Запускаем задачу на Replicate
    num_frames = min(duration * 16, 81)  # Wan2.1 max 81 frames
    prediction = replicate_request("POST", "/models/wavespeedai/wan-2.1-i2v-480p/predictions", {
        "input": {
            "image": img_url,
            "prompt": prompt,
            "num_frames": num_frames,
            "sample_steps": 30,
            "fast_mode": "Balanced",
        }
    })

    job_id = prediction.get("id")
    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({"job_id": job_id, "status": prediction.get("status")}),
    }
