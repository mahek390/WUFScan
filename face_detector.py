import sys
import json
import cv2
import numpy as np
from PIL import Image
import fitz  # PyMuPDF

def detect_faces_in_image(image_path):
    """Detect faces in images using OpenCV"""
    try:
        # Load cascade classifier
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Read image
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        return {
            "success": True,
            "faces_detected": len(faces),
            "message": f"Detected {len(faces)} face(s) in image"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def detect_faces_in_pdf(pdf_path):
    """Extract images from PDF and detect faces"""
    try:
        doc = fitz.open(pdf_path)
        total_faces = 0
        pages_with_faces = []
        
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images()
            
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                
                # Convert to numpy array
                nparr = np.frombuffer(image_bytes, np.uint8)
                img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img_np is not None:
                    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                    
                    if len(faces) > 0:
                        total_faces += len(faces)
                        pages_with_faces.append(page_num + 1)
        
        return {
            "success": True,
            "faces_detected": total_faces,
            "pages_with_faces": list(set(pages_with_faces)),
            "message": f"Detected {total_faces} face(s) across {len(set(pages_with_faces))} page(s)"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    file_path = sys.argv[1]
    file_type = sys.argv[2]
    
    if file_type in ['jpg', 'jpeg', 'png']:
        result = detect_faces_in_image(file_path)
    elif file_type == 'pdf':
        result = detect_faces_in_pdf(file_path)
    else:
        result = {"success": False, "error": "Unsupported file type"}
    
    print(json.dumps(result))
