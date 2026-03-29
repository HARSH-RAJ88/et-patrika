import logging, sys
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | VIDEO_STUDIO | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("et_patrika_video_studio")
