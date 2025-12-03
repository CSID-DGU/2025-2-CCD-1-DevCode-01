import { useRef } from "react";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import { useFocusSpeak } from "@shared/tts/useFocusSpeak";

type Props = {
  onSelectFile: (file: File) => void;
  busy?: boolean;
};

export default function UploadBar({ onSelectFile, busy }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => inputRef.current?.click();

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
    e.currentTarget.value = "";
  };

  const addLectureDocs = useFocusSpeak({
    text: "자료 추가, pdf 파일을 선택해주세요.",
  });

  return (
    <AddBar role="region" aria-label="자료 추가 영역" aria-busy={!!busy}>
      <AddBarTop>
        <AddBtn
          type="button"
          onClick={openPicker}
          aria-controls="doc-file-input"
          aria-describedby="doc-file-desc"
          onFocus={addLectureDocs.onFocus}
          onBlur={addLectureDocs.onBlur}
        >
          <Plus aria-hidden>＋</Plus>
          <span>자료 추가</span>
        </AddBtn>
        <p>
          * AI 분석 결과는 참고용이며 오류가 있을 수 있습니다. <br />* 교안
          텍스트는 ai 분석 결과로, 일부 내용이 정확하지 않을 수 있습니다.
        </p>
      </AddBarTop>
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

const AddBarTop = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 10px;

  p {
    display: flex;
    justify-content: flex-start;
    ${fonts.regular17}
    color: var(--c-grayD)
  }
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
    outline: 5px solid var(--c-blue);
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
