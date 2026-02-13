import logging
import sys

class ColouredFormatter(logging.Formatter):
    """Custom logging formatter to add ANSI colors based on log level."""
    
    GREY = "\x1b[38;21m"
    GREEN = "\x1b[32m"
    YELLOW = "\x1b[33m"
    RED = "\x1b[31m"
    BOLD_RED = "\x1b[31;1m"
    RESET = "\x1b[0m"
    
    FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    LEVEL_COLORS = {
        logging.DEBUG: GREY,
        logging.INFO: GREEN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: BOLD_RED
    }

    def format(self, record):
        log_fmt = self.LEVEL_COLORS.get(record.levelno, self.RESET) + self.FORMAT + self.RESET
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)

def setup_logging(level=logging.INFO):
    """Setup global logging with colored formatter."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColouredFormatter())
    
    logging.root.setLevel(level)
    # Remove existing handlers to avoid duplicate logs
    for h in logging.root.handlers[:]:
        logging.root.removeHandler(h)
    
    logging.root.addHandler(handler)
