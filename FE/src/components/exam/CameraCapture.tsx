import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

type Props = {
  onCapture: (file: File) => void;
  onError?: (message: string) => void;
};

const CameraCapture = ({ onCapture, onError }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- 카메라 스트림 요청 ---------- */
  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg =
          "브라우저에서 카메라를 지원하지 않습니다. 사진 선택 모드를 이용해주세요.";
        setError(msg);
        onError?.(msg);
        return;
      }

      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" }, // 후면 카메라 우선
          },
        });

        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (e) {
        console.error(e);
        const msg =
          "카메라에 접근할 수 없습니다. 브라우저 권한을 확인해주세요.";
        setError(msg);
        onError?.(msg);
      }
    };

    init();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadedMetadata = () => {
    setReady(true);
  };

  /* ---------- 사진 캡처 ---------- */
  const handleShot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `exam-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.9
    );
  };

  if (error) {
    return <ErrorText>{error}</ErrorText>;
  }

  return (
    <CameraWrapper>
      <VideoBox>
        <Video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
        />
        {!ready && <VideoOverlay>카메라 준비 중...</VideoOverlay>}
      </VideoBox>

      <ShotButton
        type="button"
        onClick={handleShot}
        disabled={!ready}
        aria-disabled={!ready}
      >
        {ready ? "사진 찍기" : "카메라 준비 중"}
      </ShotButton>
    </CameraWrapper>
  );
};

export default CameraCapture;

/* ---------- styled-components ---------- */

const CameraWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const VideoBox = styled.div`
  position: relative;
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  aspect-ratio: 3 / 4;

  @media (min-width: 768px) {
    aspect-ratio: 4 / 3;
  }
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const VideoOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e5e7eb;
  font-size: 0.9rem;
  background: rgba(15, 23, 42, 0.4);
`;

const ShotButton = styled.button`
  align-self: center;
  margin-top: 4px;
  padding: 10px 18px;
  border-radius: 999px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.p`
  font-size: 0.85rem;
  color: #ef4444;
`;
