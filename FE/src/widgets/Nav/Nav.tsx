import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContrastMode } from "@shared/useContrastMode";
import { useContrastImage } from "@shared/useContrastImage";
import { useAudioRecorder } from "@shared/useAudioRecorder";
import * as s from "./style";
import type { NavVariant } from "./types";
import A11yModal from "@layouts/components/nav/A11yModal";

type Props = { variant: NavVariant; title?: string };

// 오른쪽 공통 액션
const RightActions = ({
  isHC,
  onOpenA11y,
  soundSrc,
  eyeSrc,
  onRead,
}: {
  isHC: boolean;
  onOpenA11y: () => void;
  soundSrc: string;
  eyeSrc: string;
  onRead?: () => void;
}) => (
  <>
    <s.ActionButton
      type="button"
      aria-label="화면읽기"
      title="화면읽기"
      onClick={onRead}
    >
      <img src={soundSrc} alt="" aria-hidden />
      <em>화면읽기</em>
    </s.ActionButton>
    <s.ActionButton
      type="button"
      onClick={onOpenA11y}
      aria-pressed={isHC}
      aria-label="화면설정"
      title="화면설정"
    >
      <img src={eyeSrc} alt="" aria-hidden />
      <em>화면설정</em>
    </s.ActionButton>
  </>
);

// 왼쪽 공통: 뒤로가기
const BackButton = ({ icon, onBack }: { icon: string; onBack: () => void }) => (
  <s.ActionButton
    type="button"
    onClick={onBack}
    aria-label="뒤로가기"
    title="뒤로가기"
  >
    <img src={icon} alt="" aria-hidden />
    <em>뒤로가기</em>
  </s.ActionButton>
);

// 왼쪽 아이콘 버튼
const LeftIconButton = ({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
}) => (
  <s.ActionButton
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
  >
    <img src={icon} alt="" aria-hidden />
    <em>{label}</em>
  </s.ActionButton>
);

// 시간 포맷
const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const sss = (sec % 60).toString().padStart(2, "0");
  return `${m}:${sss}`;
};

const Nav = ({ variant, title }: Props) => {
  const nav = useNavigate();
  const { isHC } = useContrastMode();
  const [a11yOpen, setA11yOpen] = useState(false);

  const logo = useContrastImage("/img/nav/logo");
  const sound = useContrastImage("/img/nav/sound");
  const eye = useContrastImage("/img/nav/eye");
  const back = useContrastImage("/img/nav/back");
  const summary = useContrastImage("/img/nav/summary");
  const record = useContrastImage("/img/nav/record");
  const classSummary = useContrastImage("/img/nav/classSummary");

  // 녹음 훅
  const { state, error, seconds, start, pause, resume, stop } =
    useAudioRecorder();

  // 정지 직후 "그 시간 그대로" 보여주기 위한 상태
  const [justStopped, setJustStopped] = useState(false);

  // stop 누른 직후 pill 계속 보여주되, 필요하면 자동 숨김 타이머(선택)
  useEffect(() => {
    if (justStopped) {
      const t = setTimeout(() => setJustStopped(false), 8000);
      return () => clearTimeout(t);
    }
  }, [justStopped]);

  // 1) 로그인/회원가입
  if (variant === "auth") {
    return (
      <s.NavWrapper
        role="banner"
        aria-label="로그인/회원가입 네비게이션"
        data-variant="auth"
      >
        <s.BrandArea>
          <img src={logo} alt="캠퍼스 메이트 로고" />
          <s.BrandText>{title ?? "캠퍼스 메이트"}</s.BrandText>
        </s.BrandArea>
        <s.Actions>
          <RightActions
            isHC={isHC}
            onOpenA11y={() => setA11yOpen(true)}
            soundSrc={sound}
            eyeSrc={eye}
          />
        </s.Actions>
      </s.NavWrapper>
    );
  }

  // 2) 폴더 탭
  if (variant === "folder") {
    return (
      <s.NavWrapper data-variant="folder">
        <s.FolderLeft>
          <img src={logo} alt="캠퍼스 메이트 로고" />
          <s.TabNav role="tablist" aria-label="폴더 탭">
            <s.TabLink to="/" end>
              홈
            </s.TabLink>
            <s.TabLink to="/exam">시험</s.TabLink>
          </s.TabNav>
        </s.FolderLeft>
        <s.Title aria-live="polite">{title ?? " "}</s.Title>
        <s.Right>
          <RightActions
            isHC={isHC}
            onOpenA11y={() => setA11yOpen(true)}
            soundSrc={sound}
            eyeSrc={eye}
          />
        </s.Right>
        <A11yModal open={a11yOpen} onClose={() => setA11yOpen(false)} />
      </s.NavWrapper>
    );
  }

  // 3) 수업 전/중/후/시험
  const isClassFlow = ["pre", "live", "post", "exam"].includes(variant);

  return (
    <s.NavWrapper data-variant={variant}>
      {/* Left */}
      <s.Left>
        {isClassFlow ? (
          <s.LeftActions>
            <BackButton icon={back} onBack={() => nav(-1)} />

            {variant === "pre" && (
              <LeftIconButton
                icon={summary}
                label="자료요약"
                onClick={() => {}}
              />
            )}

            {variant === "live" && (
              <>
                {/* 메인 토글: idle→start / recording→pause / paused→resume */}
                <LeftIconButton
                  icon={record}
                  label={
                    state === "idle"
                      ? "녹음"
                      : state === "recording"
                      ? "일시정지"
                      : "다시시작"
                  }
                  onClick={() => {
                    if (state === "idle") {
                      setJustStopped(false); // 재녹음 시작 시 justStopped 해제
                      start();
                    } else if (state === "recording") {
                      pause();
                    } else if (state === "paused") {
                      resume();
                    }
                  }}
                />

                {/* 녹음/일시정지 중 pill */}
                {(state === "recording" || state === "paused") && (
                  <s.RecPill role="group" aria-label="녹음 컨트롤">
                    {/* 일시정지 중이면 play, 녹음 중이면 pause */}
                    {state === "paused" ? (
                      <img
                        src="/img/nav/play.png"
                        alt="다시시작"
                        onClick={() => resume()}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: "pointer",
                        }}
                      />
                    ) : (
                      <img
                        src="/img/nav/pause.png"
                        alt="일시정지"
                        onClick={() => pause()}
                        style={{
                          width: 22,
                          height: 22,
                          cursor: "pointer",
                        }}
                      />
                    )}

                    <img
                      src="/img/nav/stop.png"
                      alt="정지"
                      onClick={() => {
                        stop();
                        setJustStopped(true);
                      }}
                    />

                    <span className="rec-time">{formatTime(seconds)}</span>
                  </s.RecPill>
                )}

                {/* 정지 직후: 시간 유지 + 재시작 아이콘만 노출 */}
                {state === "idle" && justStopped && (
                  <s.RecPill role="group" aria-label="재녹음 컨트롤">
                    <img
                      src="/img/nav/play.png"
                      alt="다시 시작"
                      onClick={() => {
                        setJustStopped(false);
                        start();
                      }}
                    />
                    <span className="rec-time">{formatTime(seconds)}</span>
                  </s.RecPill>
                )}
              </>
            )}

            {variant === "post" && (
              <LeftIconButton
                icon={classSummary}
                label="수업요약"
                onClick={() => {}}
              />
            )}
          </s.LeftActions>
        ) : (
          <span aria-hidden />
        )}
      </s.Left>

      {/* Center */}
      <s.Title aria-live="polite">{title ?? " "}</s.Title>

      {/* Right */}
      <s.Right>
        <RightActions
          isHC={isHC}
          onOpenA11y={() => setA11yOpen(true)}
          soundSrc={sound}
          eyeSrc={eye}
          onRead={() => {}}
        />
      </s.Right>

      <A11yModal open={a11yOpen} onClose={() => setA11yOpen(false)} />

      {error && (
        <span role="alert" style={{ position: "absolute", left: -9999 }}>
          {error}
        </span>
      )}
    </s.NavWrapper>
  );
};

export default Nav;
