import fitz
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer
from django.core.files.base import ContentFile

def special_char(text):
    replacements = {
        'à': '→', 'â': '⇒', 'á': '▶',
        'â€œ': '"', 'â€': '"', 'â€˜': "'", 'â€™': "'",
        'â€¦': '...', '·': '·', '•': '•',
        'Ã—': '×', 'Ã‚±': '±',
        '–': '-', '—': '—',
        'Â©': '©', 'Â®': '®', 'Â°': '°',
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def pdf_to_text(file):
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        page_texts = []
        for page_layout in extract_pages(tmp_path):
            text = ""
            for element in page_layout:
                if isinstance(element, LTTextContainer):
                    text += element.get_text()

            cleaned = special_char(text.strip())      
            page_texts.append(cleaned)

        return page_texts

    except Exception as e:
        print(f"[ERROR] PDFMiner text extraction failed: {e}")
        return []


def pdf_to_embedded_images(page, pdf):

    images = []
    for idx, img in enumerate(page.get_images(full=True), start=1):
        xref = img[0]
        base_image = pdf.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        images.append({
            "bytes": image_bytes,
            "ext": image_ext,
            "name": f"embedded_{idx}.{image_ext}"
        })
    return images

def pdf_to_image(page, title, page_num):

    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("png")
    image_file = ContentFile(img_bytes, name=f"{title}_page{page_num}.png")
    return image_file

