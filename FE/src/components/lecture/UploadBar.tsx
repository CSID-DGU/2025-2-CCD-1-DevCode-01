// src/components/lecture/UploadBar.tsx
import styled from "styled-components";
import { fonts } from "@styles/fonts";

type Props = {
  onSelectFile: (file: File) => void;
};

export default function UploadBar({ onSelectFile }: Props) {
  return (
    <AddBar role="region" aria-label="자료 추가 영역">
      <FileLabel htmlFor="doc-file-input">
        <Plus aria-hidden>＋</Plus>
        <span>자료 추가</span>
      </FileLabel>
      <input
        id="doc-file-input"
        type="file"
        accept="
          application/pdf,
          application/vnd.ms-powerpoint,
          application/vnd.openxmlformats-officedocument.presentationml.presentation
        "
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelectFile(file);

          e.currentTarget.value = "";
        }}
        aria-label="교안 파일 선택"
        style={{ display: "none" }}
      />
    </AddBar>
  );
}

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

const FileLabel = styled.label`
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
