
import re
import time

TEXT_COMMANDS = [
    "textbf", "textit", "textrm", "textsf",
    "texttt", "text", "mathrm", "mathbf"
]

MATH_PATTERNS = [
    r'\\\((.*?)\\\)',
    r'\\\[(.*?)\\\]',
    r'\$\$(.*?)\$\$',
    r'\\begin\{.*?\}.*?\\end\{.*?\}'
]

# 수식 치환 함수
def safe_sub(pattern, repl, text):
    def wrapper(match):
        start = match.start()
        # 이미 <수식> 태그 안에 있는지 검사
        open_tag = text.rfind("<수식>", 0, start)
        close_tag = text.rfind("</수식>", 0, start)

        # <수식>은 보였지만 </수식>이 안 보였다 → 수식 내부
        if open_tag != -1 and (close_tag == -1 or close_tag < open_tag):
            return match.group(0)
        return repl(match)

    return re.sub(pattern, wrapper, text, flags=re.DOTALL)

#수식 밖 Latex 제거
def remove_text(text: str) -> str:
    math_spans = []
    for pattern in MATH_PATTERNS:
        for m in re.finditer(pattern, text, flags=re.DOTALL):
            math_spans.append((m.start(), m.end()))

    def is_inside_math(pos):
        for start, end in math_spans:
            if start <= pos < end:
                return True
        return False

    def replacer(match):
        cmd = match.group(1)
        inner = match.group(2)
        start = match.start()

        if is_inside_math(start):
            return match.group(0)
        return inner

    pattern = r'\\(' + '|'.join(TEXT_COMMANDS) + r')\{([^{}]+)\}'
    return re.sub(pattern, replacer, text)

def latex_rewrite(text: str) -> str:
    # \( ... \)
    text = safe_sub(
        r'\\\((.*?)\\\)',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text
    )

    # \[ ... \]
    text = safe_sub(
        r'\\\[(.*?)\\\]',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text
    )

    # $$ ... $$
    text = safe_sub(
        r'\$\$(.*?)\$\$',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text
    )

    # \begin{env} ... \end{env}
    text = safe_sub(
        r'\\begin\{.*?\}.*?\\end\{.*?\}',
        lambda m: f"<수식>\n{m.group(0).strip()}\n</수식>",
        text
    )

    # 중첩 제거
    text = rewrite_nesting_fixed(text)

    return text


def rewrite_nesting_fixed(text: str) -> str:
    # 태그 중첩 제거
    text = re.sub(r'<수식>\s*<수식>', '<수식>', text)
    text = re.sub(r'</수식>\s*</수식>', '</수식>', text)

    def remove_inner(match):
        inner = match.group(1)
        inner = inner.replace("<수식>", "").replace("</수식>", "")
        return f"<수식>\n{inner.strip()}\n</수식>"

    text = re.sub(r'<수식>([\s\S]*?)</수식>', remove_inner, text)

    return text

def process_latex(text: str) -> str:
    text = remove_text(text)       # 텍스트용 LaTeX 제거
    text = latex_rewrite(text)     # 수식 변환
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
