// src/components/lecture/UploadBar.tsx
import { useRef } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";

type Props = {
  onSelectFile: (file: File) => void;
  busy?: boolean; // 선택(로딩 스피너 등 쓸 때)
};

export default function UploadBar({ onSelectFile, busy }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => inputRef.current?.click();

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
    e.currentTarget.value = ""; // 같은 파일 재선택 대비 초기화
  };

  return (
    <AddBar role="region" aria-label="자료 추가 영역" aria-busy={!!busy}>
      <AddBtn
        type="button"
        onClick={openPicker}
        aria-controls="doc-file-input"
        aria-describedby="doc-file-desc"
      >
        <Plus aria-hidden>＋</Plus>
        <span>자료 추가</span>
      </AddBtn>

      <VisuallyHidden id="doc-file-desc">
        PDF 또는 파워포인트 파일을 선택합니다.
      </VisuallyHidden>

      <input
        id="doc-file-input"
        ref={inputRef}
        type="file"
        accept="
          application/pdf,
          application/vnd.ms-powerpoint,
          application/vnd.openxmlformats-officedocument.presentationml.presentation
        "
        onChange={onChange}
        aria-label="교안 파일 선택"
        style={{ display: "none" }}
      />
    </AddBar>
  );
}

/* styles */
const AddBar = styled.div`
  grid-column: 1 / -1;
  grid-row: 1;
  position: sticky;
  top: 0;
  z-index: 10;
  padding-bottom: 0.25rem;
  margin-bottom: 0.25rem;
  background: var(--c-white);
  display: flex;
  justify-content: center;
`;

const AddBtn = styled.button`
  width: 100%;
  ${fonts.regular24};
  border-radius: 12px;
  padding: 0.875rem 1.25rem;
  background: white;
  border: 2px solid var(--c-blueL);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  color: black;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
`;

const Plus = styled.span`
  font-size: 1.5rem;
  line-height: 1;
`;

// 스크린리더 전용
const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
