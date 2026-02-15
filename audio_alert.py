import os
import json
from elevenlabs import generate, play, set_api_key

def generate_alert(risk_level, findings_count):
    """Generate audio alert for scan results using ElevenLabs"""
    try:
        api_key = os.getenv('ELEVEN_LABS_API_KEY')
        if not api_key:
            return {"success": False, "error": "ELEVEN_LABS_API_KEY not set"}
        
        set_api_key(api_key)
        
        # Create alert message based on risk level
        if risk_level == "CRITICAL":
            message = f"Critical security alert! {findings_count} critical issues detected in your document. Immediate action required."
        elif risk_level == "HIGH":
            message = f"High risk detected. {findings_count} security issues found. Review before sharing."
        elif risk_level == "MEDIUM":
            message = f"Medium risk. {findings_count} potential issues identified. Please review."
        else:
            message = f"Scan complete. {findings_count} items flagged for review."
        
        # Generate audio
        audio = generate(
            text=message,
            voice="Adam",  # Professional male voice
            model="eleven_monolingual_v1"
        )
        
        # Save to file
        output_path = "alert_audio.mp3"
        with open(output_path, "wb") as f:
            f.write(audio)
        
        return {"success": True, "audio_path": output_path, "message": message}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import sys
    risk_level = sys.argv[1]
    findings_count = int(sys.argv[2])
    result = generate_alert(risk_level, findings_count)
    print(json.dumps(result))
