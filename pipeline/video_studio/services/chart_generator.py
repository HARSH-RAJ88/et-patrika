"""
Matplotlib Chart Generator for videos.
"""
import matplotlib.pyplot as plt
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger

def generate_chart(numbers_context: str, output_path: str) -> str:
    """
    Parse format: "Chart Title | X-axis Label | Label1: Value1 | Label2: Value2"
    """
    if not numbers_context:
        return None

    try:
        parts = [p.strip() for p in numbers_context.split("|")]
        if len(parts) < 3:
            return None
            
        title = parts[0]
        x_label = parts[1]
        
        labels = []
        values = []
        
        for data_pt in parts[2:]:
            if ":" not in data_pt:
                continue
            lbl, val_str = data_pt.split(":", 1)
            lbl = lbl.strip()
            val_str = val_str.strip().replace(",", "")
            
            try:
                # Try to extract numbers
                num_digits = "".join(filter(lambda x: x.isdigit() or x in ".-", val_str))
                val = float(num_digits)
                labels.append(lbl)
                values.append(val)
            except ValueError:
                continue

        if not labels:
            return None

        # Style matches ET Patrika dark theme
        plt.style.use('dark_background')
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#0D0D0D")
        ax.set_facecolor("#0D0D0D")
        
        bars = ax.bar(labels, values, color="#555555")
        
        # Highlight highest bar in ET Patrika Red
        if values:
            max_idx = values.index(max(values))
            bars[max_idx].set_color("#E8132B")
        
        ax.set_title(title, fontsize=18, pad=20, color='white', fontweight='bold')
        ax.set_xlabel(x_label, fontsize=12, color='#CCCCCC')
        
        # Grid lines
        ax.yaxis.grid(True, linestyle='--', alpha=0.3)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_color('#555555')
        ax.spines['left'].set_color('#555555')
        
        # Subtitle/Watermark
        plt.text(0.99, 0.01, 'ET Patrika', ha='right', va='bottom', 
                 transform=ax.transAxes, color='#E8132B', fontsize=12, alpha=0.7, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=120, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close()
        
        return output_path
        
    except Exception as e:
        logger.error(f"Chart generation failed: {e}")
        return None
