
import re

#수식 후처리
def latex_rewrite(text: str) -> str:
    # \[ ... \]
    text = re.sub(
        r'\\\[(.*?)\\\]',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text,
        flags=re.DOTALL
    )

    # $$ ... $$
    text = re.sub(
        r'\$\$(.*?)\$\$',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text,
        flags=re.DOTALL
    )

    # \( ... \)
    text = re.sub(
        r'\\\((.*?)\\\)',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text
    )

    # \begin{env} ... \end{env}
    text = re.sub(
        r'(\\begin\{.*?\}.*?\\end\{.*?\})',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text,
        flags=re.DOTALL
    )

    return text

#코드 후처리
def code_rewrite(text: str) -> str:

    # ``` ... ``` 감지
    text = re.sub(
        r"```(.*?)```",
        lambda m: f"<코드>\n{m.group(1).strip()}\n</코드>",
        text,
        flags=re.DOTALL
    )

    return text