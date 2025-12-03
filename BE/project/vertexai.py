from django.conf import settings
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(
    project=settings.GCP_PROJECT_ID,
    location=settings.GCP_REGION,
)

gemini_model = GenerativeModel("gemini-2.5-flash")