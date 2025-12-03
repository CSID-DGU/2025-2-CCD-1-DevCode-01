
import re

#중첩된 수식 제거
def rewrite_nesting(text: str) -> str:
    text = re.sub(r'<수식>\s*<수식>', '<수식>', text)
    text = re.sub(r'</수식>\s*</수식>', '</수식>', text)

    def remove_inner(match):
        content = match.group(1)
        content = re.sub(r'</?수식>', '', content)
        return f"<수식>\n{content.strip()}\n</수식>"

    text = re.sub(r'<수식>(.*?)</수식>', remove_inner, text, flags=re.DOTALL)
    return text

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
    text = rewrite_nesting(text)
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