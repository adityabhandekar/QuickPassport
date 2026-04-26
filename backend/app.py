import os
import uuid
import requests
from flask import Flask, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from PIL import Image, ImageColor
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader

load_dotenv()

app = Flask(__name__)
CORS(app)

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)

REMOVE_BG_API_KEY = os.getenv("REMOVE_BG_API_KEY")

PHOTO_SIZES = {
    "35x45": (35, 45),
    "2x2": (50.8, 50.8),
    "50x50": (50, 50),
}


def mm_to_px(mm, dpi=300):
    return int((mm / 25.4) * dpi)


def remove_background(input_path, output_path, size="auto"):
    if not REMOVE_BG_API_KEY:
        raise Exception("REMOVE_BG_API_KEY missing in .env")

    with open(input_path, "rb") as img:
        response = requests.post(
            "https://api.remove.bg/v1.0/removebg",
            files={"image_file": img},
            data={"size": size},
            headers={"X-Api-Key": REMOVE_BG_API_KEY},
        )

    if response.status_code == requests.codes.ok:
        with open(output_path, "wb") as out:
            out.write(response.content)
        return True

    print(response.text)
    return False


def add_background(input_path, output_path, bg_color):
    img = Image.open(input_path).convert("RGBA")

    try:
        rgb_color = ImageColor.getrgb(bg_color)
    except Exception:
        rgb_color = (255, 255, 255)

    bg = Image.new("RGB", img.size, rgb_color)
    bg.paste(img, mask=img.split()[3])
    bg.save(output_path, quality=95)


def resize_passport_photo(input_path, output_path, size_key):
    width_mm, height_mm = PHOTO_SIZES.get(size_key, PHOTO_SIZES["35x45"])
    width_px = mm_to_px(width_mm)
    height_px = mm_to_px(height_mm)

    img = Image.open(input_path).convert("RGB")
    img = img.resize((width_px, height_px))
    img.save(output_path, quality=95)


def create_a4_sheet_image(photo_path, output_path, size_key, copies):
    width_mm, height_mm = PHOTO_SIZES.get(size_key, PHOTO_SIZES["35x45"])

    dpi = 300
    a4_width_px = mm_to_px(210, dpi)
    a4_height_px = mm_to_px(297, dpi)

    photo_width_px = mm_to_px(width_mm, dpi)
    photo_height_px = mm_to_px(height_mm, dpi)

    margin_px = mm_to_px(10, dpi)
    gap_px = mm_to_px(4, dpi)

    sheet = Image.new("RGB", (a4_width_px, a4_height_px), "white")
    photo = Image.open(photo_path).convert("RGB")
    photo = photo.resize((photo_width_px, photo_height_px))

    cols = (a4_width_px - 2 * margin_px) // (photo_width_px + gap_px)
    rows = (a4_height_px - 2 * margin_px) // (photo_height_px + gap_px)

    max_photos = cols * rows
    total = max_photos if copies == "auto" else min(int(copies), max_photos)

    count = 0
    y = margin_px

    for _ in range(rows):
        x = margin_px

        for _ in range(cols):
            if count >= total:
                break

            sheet.paste(photo, (x, y))
            x += photo_width_px + gap_px
            count += 1

        y += photo_height_px + gap_px

        if count >= total:
            break

    sheet.save(output_path, quality=95)


def create_pdf_from_sheet(sheet_path, pdf_path):
    c = canvas.Canvas(pdf_path, pagesize=A4)
    page_width, page_height = A4

    c.drawImage(
        ImageReader(sheet_path),
        0,
        0,
        width=page_width,
        height=page_height,
    )

    c.save()


@app.route("/", methods=["GET"])
def home():
    return {"message": "QuickPassport backend running"}


@app.route("/preview", methods=["POST"])
def preview():
    if "image" not in request.files:
        return {"error": "No image uploaded"}, 400

    file = request.files["image"]
    bg_color = request.form.get("bgColor", "#ffffff")

    unique_id = str(uuid.uuid4())

    original_path = os.path.join(TEMP_DIR, f"{unique_id}_preview_original.png")
    no_bg_path = os.path.join(TEMP_DIR, f"{unique_id}_preview_nobg.png")
    preview_path = os.path.join(TEMP_DIR, f"{unique_id}_preview_final.jpg")

    file.save(original_path)

    # Faster preview
    success = remove_background(original_path, no_bg_path, size="preview")

    if not success:
        return {"error": "Background removal failed"}, 500

    add_background(no_bg_path, preview_path, bg_color)

    return send_file(preview_path, mimetype="image/jpeg")


@app.route("/generate", methods=["POST"])
def generate():
    if "image" not in request.files:
        return {"error": "No image uploaded"}, 400

    file = request.files["image"]

    bg_color = request.form.get("bgColor", "#ffffff")
    size_key = request.form.get("size", "35x45")
    copies = request.form.get("copies", "auto")
    output_type = request.form.get("outputType", "pdf")

    unique_id = str(uuid.uuid4())

    original_path = os.path.join(TEMP_DIR, f"{unique_id}_original.png")
    no_bg_path = os.path.join(TEMP_DIR, f"{unique_id}_nobg.png")
    bg_path = os.path.join(TEMP_DIR, f"{unique_id}_bg.jpg")
    passport_path = os.path.join(TEMP_DIR, f"{unique_id}_passport.jpg")
    sheet_path = os.path.join(TEMP_DIR, f"{unique_id}_sheet.jpg")
    pdf_path = os.path.join(TEMP_DIR, f"{unique_id}_sheet.pdf")

    file.save(original_path)

    success = remove_background(original_path, no_bg_path, size="auto")

    if not success:
        return {"error": "Background removal failed"}, 500

    add_background(no_bg_path, bg_path, bg_color)
    resize_passport_photo(bg_path, passport_path, size_key)
    create_a4_sheet_image(passport_path, sheet_path, size_key, copies)

    if output_type == "jpg":
        return send_file(
            sheet_path,
            as_attachment=True,
            download_name="quickpassport_sheet.jpg",
            mimetype="image/jpeg",
        )

    create_pdf_from_sheet(sheet_path, pdf_path)

    return send_file(
        pdf_path,
        as_attachment=True,
        download_name="quickpassport_sheet.pdf",
        mimetype="application/pdf",
    )


if __name__ == "__main__":
    app.run(debug=True)