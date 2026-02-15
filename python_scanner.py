import sys
import json
import os
from PIL import Image
import pytesseract

try:
    from twelvelabs import TwelveLabs
    TWELVE_LABS_AVAILABLE = True
except:
    TWELVE_LABS_AVAILABLE = False

def scan_image(file_path):
    """Extract text from images using OCR"""
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return {"success": True, "text": text}
    except Exception as e:
        return {"success": False, "error": str(e)}

def scan_video(file_path):
    """Scan video for sensitive content using Twelve Labs"""
    if not TWELVE_LABS_AVAILABLE:
        return {"success": False, "error": "Twelve Labs not installed"}
    
    try:
        api_key = os.getenv('TWELVE_LABS_API_KEY')
        index_id = os.getenv('TWELVE_LABS_INDEX_ID', '').strip()
        
        if not api_key:
            return {"success": False, "error": "TWELVE_LABS_API_KEY not set"}
        if not index_id:
            return {"success": False, "error": "TWELVE_LABS_INDEX_ID not set"}
        
        client = TwelveLabs(api_key=api_key)
        
        # Upload video
        print(f"Uploading video to Twelve Labs...")
        task = client.task.create(
            index_id=index_id,
            file=file_path,
            language="en"
        )
        
        # Wait for processing
        print("Processing video...")
        task.wait_for_done(sleep_interval=5)
        video_id = task.video_id
        
        # Get full transcription
        print("Extracting transcription...")
        video_data = client.index.video.get(index_id=index_id, id=video_id)
        
        # Extract all text from video
        full_text = ""
        
        # Get transcription if available
        if hasattr(video_data, 'metadata') and video_data.metadata:
            if 'transcript' in video_data.metadata:
                full_text += video_data.metadata['transcript'] + "\n"
        
        # Search for specific sensitive patterns
        sensitive_queries = [
            "email address shown on screen",
            "phone number visible",
            "social security number displayed",
            "credit card number shown",
            "passport document visible",
            "home address displayed",
            "date of birth shown",
            "confidential document",
            "API key visible on screen",
            "clear face of person",
            "identity document shown",
            "driver license visible"
        ]
        
        findings_text = ""
        for query in sensitive_queries:
            try:
                results = client.search.query(
                    index_id=index_id,
                    query_text=query,
                    options=["visual", "conversation"],
                    video_id=video_id,
                    threshold="high"  # Only high confidence matches
                )
                
                if results.data and len(results.data) > 0:
                    # Only include if confidence score is high
                    high_confidence_results = [r for r in results.data if hasattr(r, 'score') and r.score > 80]
                    
                    if high_confidence_results:
                        findings_text += f"\n--- Found: {query} (Confidence: High) ---\n"
                        for result in high_confidence_results[:2]:  # Top 2 matches
                            if hasattr(result, 'text'):
                                findings_text += result.text + "\n"
                            if hasattr(result, 'metadata'):
                                if 'transcript' in result.metadata:
                                    findings_text += result.metadata['transcript'] + "\n"
            except Exception as e:
                print(f"Search error for '{query}': {e}")
        
        combined_text = full_text + findings_text
        
        if not combined_text.strip():
            combined_text = "Video processed but no text or sensitive content detected."
        
        return {"success": True, "text": combined_text}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    file_path = sys.argv[1]
    file_type = sys.argv[2]
    
    if file_type in ['jpg', 'jpeg', 'png']:
        result = scan_image(file_path)
    elif file_type in ['mp4', 'avi', 'mov']:
        result = scan_video(file_path)
    else:
        result = {"success": False, "error": "Unsupported file type"}
    
    print(json.dumps(result))
