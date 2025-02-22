from PIL import Image
import os
from pathlib import Path

def convert_to_webp(source_path, quality=80):
    """Convert images to WebP format with optimization"""
    destination = source_path.with_suffix('.webp')
    
    image = Image.open(source_path)
    
    # Convert RGBA to RGB if necessary
    if image.mode in ('RGBA', 'LA'):
        background = Image.new('RGB', image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        image = background
    
    image.save(str(destination), 'WEBP', quality=quality)
    return destination

def optimize_images():
    """Batch convert all images in static/images to WebP"""
    static_dir = Path('static/images')
    
    # Create directories if they don't exist
    static_dir.mkdir(parents=True, exist_ok=True)
    
    # Process all images
    for image_path in static_dir.glob('*'):
        if image_path.suffix.lower() in ('.png', '.jpg', '.jpeg'):
            print(f"Converting {image_path.name} to WebP...")
            convert_to_webp(image_path)

if __name__ == "__main__":
    optimize_images() 