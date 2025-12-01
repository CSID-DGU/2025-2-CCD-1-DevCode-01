import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import toast from "react-hot-toast";

import Spinner from "src/components/common/Spinner";
import CameraCapture from "src/components/exam/CameraCapture";
import {
  fetchExamResult,
  startExam,
  type ExamResultResponse,
} from "@apis/exam/exam.api";
import { fonts } from "@styles/fonts";

type CaptureMode = "camera" | "file";

const Exam = () => {
  const navigate = useNavigate();

  const [initialChecking, setInitialChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [endTime, setEndTime] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [mode, setMode] = useState<CaptureMode>("camera");

  /* ---------- 1) 현재 시험 상태 확인 ---------- */
  useEffect(() => {
    const checkExam = async () => {
      const data = await fetchExamResult();

      if (data) {
        navigate("/exam/take", {
          replace: true,
          state: { exam: data },
        });
      } else {
        setInitialChecking(false);
      }
    };

    checkExam();
  }, [navigate]);

  /* ---------- 2) 사진 선택 (파일 업로드) ---------- */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setImages((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  /* ---------- 3) 카메라 캡처 ---------- */
  const handleCapture = (file: File) => {
    setImages((prev) => [...prev, file]);
    toast.success("사진이 추가되었습니다.");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ---------- 4) 시험 시작 제출 ---------- */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!endTime) {
      toast.error("시험 종료 시간을 설정해주세요.");
      return;
    }
    if (images.length === 0) {
      toast.error("시험지 사진을 한 장 이상 촬영하거나 선택해주세요.");
      return;
    }

    setSubmitting(true);
    const data: ExamResultResponse | null = await startExam(endTime, images);

    if (!data) {
      toast.error("시험 시작에 실패했습니다. 다시 시도해주세요.");
      setSubmitting(false);
      return;
    }

    toast.success("시험이 시작되었습니다.");
    navigate("/exam/take", {
      replace: true,
      state: { exam: data },
    });
  };

  const isLoading = initialChecking || submitting;

  /* ---------- 렌더 ---------- */
  return (
    <PageContainer>
      {isLoading && (
        <Overlay>
          <SpinnerWrapper>
            <Spinner />
            <p>시험지를 분석하는 중입니다.</p>
          </SpinnerWrapper>
        </Overlay>
      )}

      <Inner $dimmed={isLoading}>
        <Title>시험 시작</Title>
        <Description>
          시험 종료 시간을 설정하고, 시험지 사진을 촬영하거나 선택해
          업로드해주세요.
          <br />
          촬영한 사진은 바로 서버로 전송되며, 기기에는 저장되지 않습니다.
        </Description>

        <form onSubmit={handleSubmit}>
          {/* 종료 시간 */}
          <Field>
            <Label htmlFor="endTime">시험 종료 시간</Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
            <Hint>예: 13:30</Hint>
          </Field>

          {/* 모드 선택 : 촬영 / 사진 선택 */}
          <Field>
            <Label as="p">사진 입력 방식</Label>
            <ModeSwitch role="tablist" aria-label="사진 입력 방식 선택">
              <ModeButton
                type="button"
                role="tab"
                aria-selected={mode === "camera"}
                $active={mode === "camera"}
                onClick={() => setMode("camera")}
              >
                촬영
              </ModeButton>
              <ModeButton
                type="button"
                role="tab"
                aria-selected={mode === "file"}
                $active={mode === "file"}
                onClick={() => setMode("file")}
              >
                사진 선택
              </ModeButton>
            </ModeSwitch>
            <Hint>
              지금은 테스트를 위해 두 방식을 모두 제공하며, 추후에는 촬영만
              사용할 예정입니다.
            </Hint>
          </Field>

          {/* 모드별 입력 영역 */}
          {mode === "camera" ? (
            <Field>
              <Label as="p">카메라로 시험지 촬영</Label>
              <CameraCapture
                onCapture={handleCapture}
                onError={(msg) => toast.error(msg)}
              />
              <Hint>
                아이폰, 아이패드, 노트북 카메라 모두 사용할 수 있어요.
              </Hint>
            </Field>
          ) : (
            <Field>
              <Label>기기에서 사진 선택</Label>
              <FileInputLabel>
                <span>사진 선택하기</span>
                <HiddenFileInput
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />
              </FileInputLabel>
              <Hint>이미 찍어둔 시험지 사진을 업로드할 수 있습니다.</Hint>
            </Field>
          )}

          {/* 선택/촬영된 이미지 리스트 */}
          {images.length > 0 && (
            <ImageList>
              {images.map((file, idx) => (
                <ImageItem key={`${file.name}-${idx}`}>
                  <Thumb
                    src={URL.createObjectURL(file)}
                    alt={`시험지 사진 ${idx + 1}`}
                  />
                  <ImageMeta>
                    <p className="name">{file.name || `사진 ${idx + 1}`}</p>
                    <p className="size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </ImageMeta>
                  <RemoveButton
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                  >
                    삭제
                  </RemoveButton>
                </ImageItem>
              ))}
            </ImageList>
          )}

          <SubmitButton
            type="submit"
            disabled={isLoading || !endTime || images.length === 0}
          >
            시험 시작하기
          </SubmitButton>
        </form>
      </Inner>
    </PageContainer>
  );
};

export default Exam;

const SpinnerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  ${fonts.bold26}
  color: var(--c-white);
`;

const PageContainer = styled.div`
  width: 100%;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
  background: var(--c-white);
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div<{ $dimmed: boolean }>`
  flex: 1;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 16px 16px 80px;

  opacity: ${({ $dimmed }) => ($dimmed ? 0.5 : 1)};
  pointer-events: ${({ $dimmed }) => ($dimmed ? "none" : "auto")};

  @media (min-width: 768px) {
    padding: 24px 20px 96px;
  }
`;

const Title = styled.h1`
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--c-black);
  @media (min-width: 768px) {
    font-size: 1.6rem;
    ${fonts.bold32}
  }
`;

const Description = styled.p`
  font-size: 0.9rem;
  color: var(--c-grayD);
  line-height: 1.6;
  margin-bottom: 20px;

  @media (min-width: 768px) {
    ${fonts.regular17}
  }
`;

const Field = styled.div`
  margin-bottom: 18px;
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 6px;

  @media (min-width: 768px) {
    ${fonts.bold20};
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 11px 12px;
  font-size: 1rem;
  border-radius: 10px;
  border: 1px solid var(--c-grayD);
  background-color: var(--c-white);
  color: var(--c-black);

  &:focus {
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.25);
    outline: 2px solid var(--c-blue);
  }

  @media (min-width: 768px) {
    padding: 12px 14px;
    ${fonts.medium24}
  }
`;

const Hint = styled.p`
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--c-grayD);

  @media (min-width: 768px) {
    ${fonts.regular20}
  }
`;

const ModeSwitch = styled.div`
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--c-grayL);
  margin-bottom: 6px;
`;

const ModeButton = styled.button<{ $active: boolean }>`
  border: none;
  background: ${({ $active }) => ($active ? "var(--c-white)" : "transparent")};
  color: ${({ $active }) => ($active ? "var(--c-black)" : "var(--c-grayD)")};
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:focus-visible {
    outline: 2px solid var(--c-blue);
    outline-offset: 2px;
  }

  @media (min-width: 768px) {
    font-size: 0.9rem;
    padding: 8px 16px;
  }
`;

const FileInputLabel = styled.label`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--c-black);
  color: var(--c-white);
  font-size: 0.9rem;
  cursor: pointer;
  margin-bottom: 4px;

  &:active {
    transform: scale(0.98);
  }

  @media (min-width: 768px) {
    font-size: 1.2rem;
    padding: 11px 16px;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const ImageList = styled.ul`
  margin: 8px 0 16px;
  padding: 0;
  list-style: none;

  display: flex;
  flex-direction: column;
  gap: 8px;

  max-height: 260px;
  overflow-y: auto;

  @media (min-width: 768px) {
    max-height: 320px;
    gap: 10px;
  }
`;

const ImageItem = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
  background: var(--c-grayL);

  @media (min-width: 768px) {
    padding: 10px;
    gap: 12px;
  }
`;

const Thumb = styled.img`
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;

  @media (min-width: 768px) {
    width: 72px;
    height: 72px;
  }
`;

const ImageMeta = styled.div`
  flex: 1;
  min-width: 0;

  .name {
    font-size: 0.85rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    margin-top: 2px;
    font-size: 0.75rem;
    color: #6b7280;
  }

  @media (min-width: 768px) {
    .name {
      font-size: 0.9rem;
    }
    .size {
      font-size: 0.8rem;
    }
  }
`;

const RemoveButton = styled.button`
  border: none;
  background: transparent;
  color: white;
  font-size: 1rem;
  border: 1px solid red;
  border-radius: 16px;
  background-color: #ef4444;
  padding: 4px 10px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid #ef4444;
    outline-offset: 2px;
  }
`;

const SubmitButton = styled.button`
  position: fixed;
  left: 50%;
  bottom: env(safe-area-inset-bottom, 0px);
  transform: translateX(-50%);

  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 13px 18px;

  border-radius: 999px;
  border: none;
  background: var(--c-blue);
  color: var(--c-white);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;

  box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.12);

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (min-width: 768px) {
    bottom: 24px;
    padding: 14px 20px;
    ${fonts.bold20}
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;
