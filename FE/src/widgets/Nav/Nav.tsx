import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContrastMode } from "@shared/useContrastMode";
import { useContrastImage } from "@shared/useContrastImage";
import * as s from "./style";
import type { NavVariant } from "./types";
import A11yModal from "@layouts/components/nav/A11yModal";
import SoundModal from "@layouts/components/nav/SoundModal";
import toast from "react-hot-toast";
import { useFocusSpeak } from "@shared/tts/useFocusSpeak";

type Props = { variant: NavVariant; title?: string };

/* ---------- 공통 버튼 영역 ---------- */

const RightActions = ({
  isHC,
  onOpenA11y,
  soundSrc,
  eyeSrc,
  logoutSrc,
  onOpenSound,
  onLogout,
}: {
  isHC: boolean;
  onOpenA11y: () => void;
  soundSrc: string;
  eyeSrc: string;
  logoutSrc: string;
  onOpenSound: () => void;
  onLogout: () => void;
}) => {
  const soundSpeak = useFocusSpeak({
    text: "음성 설정 버튼",
  });

  const a11ySpeak = useFocusSpeak({
    text: "화면 설정 버튼",
  });

  const logoutSpeak = useFocusSpeak({
    text: "로그아웃 버튼",
  });

  return (
    <>
      <s.ActionButton
        type="button"
        aria-label="음성 설정"
        title="음성 설정"
        onClick={onOpenSound}
        {...soundSpeak}
      >
        <img src={soundSrc} alt="" aria-hidden />
        <em>음성 설정</em>
      </s.ActionButton>

      <s.ActionButton
        type="button"
        onClick={onOpenA11y}
        aria-pressed={isHC}
        aria-label="화면 설정"
        title="화면 설정"
        {...a11ySpeak}
      >
        <img src={eyeSrc} alt="" aria-hidden />
        <em>화면 설정</em>
      </s.ActionButton>

      <s.ActionButton
        type="button"
        onClick={onLogout}
        aria-label="로그아웃"
        title="로그아웃"
        {...logoutSpeak}
      >
        <img src={logoutSrc} alt="" aria-hidden />
        <em>로그아웃</em>
      </s.ActionButton>
    </>
  );
};

const BackButton = ({ icon, onBack }: { icon: string; onBack: () => void }) => {
  const backSpeak = useFocusSpeak({
    text: "뒤로가기",
  });

  return (
    <s.ActionButton
      type="button"
      onClick={onBack}
      aria-label="뒤로가기"
      title="뒤로가기"
      {...backSpeak}
    >
      <img src={icon} alt="" aria-hidden />
      <em>뒤로가기</em>
    </s.ActionButton>
  );
};

/* ---------- 탭 ---------- */

const FolderTabs = () => {
  const lectureTabSpeak = useFocusSpeak({
    text: "강의실 탭",
  });
  const examTabSpeak = useFocusSpeak({
    text: "시험 탭",
  });

  return (
    <s.TabNav role="tablist" aria-label="메인 탭">
      <s.TabLink to="/" end {...lectureTabSpeak}>
        강의실
      </s.TabLink>
      <s.TabLink to="/exam" {...examTabSpeak}>
        시험
      </s.TabLink>
    </s.TabNav>
  );
};

const ExamTabs = () => {
  const lectureTabSpeak = useFocusSpeak({
    text: "강의실 탭",
  });

  return (
    <s.TabNav role="tablist" aria-label="메인 탭">
      <s.TabLink to="/" end {...lectureTabSpeak}>
        강의실
      </s.TabLink>
    </s.TabNav>
  );
};

/* ---------- Nav 본체 ---------- */

const Nav = ({ variant, title }: Props) => {
  const nav = useNavigate();
  const { isHC } = useContrastMode();
  const [a11yOpen, setA11yOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);

  const logo = useContrastImage("/img/nav/logo");
  const sound = useContrastImage("/img/nav/sound");
  const eye = useContrastImage("/img/nav/eye");
  const back = useContrastImage("/img/nav/back");
  const logout = useContrastImage("/img/nav/logout");

  const handleLogout = () => {
    localStorage.clear();
    toast.success("로그아웃 되었어요.");
    nav("/login", { replace: true });
  };

  /* ---------- 1) 로그인/회원가입: 왼쪽 로고만 ---------- */
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
      </s.NavWrapper>
    );
  }

  /* ---------- 2) 시험 전용 네비게이션 ---------- */
  if (variant === "exam") {
    return (
      <s.NavWrapper data-variant="folder">
        <s.FolderLeft>
          <img src={logo} alt="캠퍼스 메이트 로고" />
          <ExamTabs />
        </s.FolderLeft>

        <s.Title aria-live="polite">{title ?? " "}</s.Title>

        <s.Right>
          <RightActions
            isHC={isHC}
            onOpenA11y={() => setA11yOpen(true)}
            soundSrc={sound}
            eyeSrc={eye}
            logoutSrc={logout}
            onOpenSound={() => setSoundOpen(true)}
            onLogout={handleLogout}
          />
        </s.Right>

        <A11yModal open={a11yOpen} onClose={() => setA11yOpen(false)} />
        <SoundModal
          open={soundOpen}
          onClose={() => setSoundOpen(false)}
          onApplied={({ rate, voice }) => {
            toast.success(`${voice}, ${rate}로 적용했어요`);
          }}
        />
      </s.NavWrapper>
    );
  }

  /* ---------- 3) 홈(폴더): 강의실 / 시험 탭 ---------- */
  if (variant === "folder") {
    return (
      <s.NavWrapper data-variant="folder">
        <s.FolderLeft>
          <img src={logo} alt="캠퍼스 메이트 로고" />
          <FolderTabs />
        </s.FolderLeft>

        <s.Title aria-live="polite">{title ?? " "}</s.Title>

        <s.Right>
          <RightActions
            isHC={isHC}
            onOpenA11y={() => setA11yOpen(true)}
            soundSrc={sound}
            eyeSrc={eye}
            logoutSrc={logout}
            onOpenSound={() => setSoundOpen(true)}
            onLogout={handleLogout}
          />
        </s.Right>

        <A11yModal open={a11yOpen} onClose={() => setA11yOpen(false)} />
        <SoundModal
          open={soundOpen}
          onClose={() => setSoundOpen(false)}
          onApplied={({ rate, voice }) => {
            toast.success(`${voice}, ${rate}로 적용했어요`);
          }}
        />
      </s.NavWrapper>
    );
  }

  /* ---------- 4) 수업 전/중/후: 뒤로가기 + 설정 ---------- */
  const isClassFlow = ["pre", "live", "post"].includes(variant);

  return (
    <s.NavWrapper data-variant={variant}>
      {/* Left */}
      <s.Left>
        {isClassFlow ? (
          <s.LeftActions>
            <BackButton icon={back} onBack={() => nav(-1)} />
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
          logoutSrc={logout}
          onOpenSound={() => setSoundOpen(true)}
          onLogout={handleLogout}
        />
      </s.Right>

      <A11yModal open={a11yOpen} onClose={() => setA11yOpen(false)} />
      <SoundModal
        open={soundOpen}
        onClose={() => setSoundOpen(false)}
        onApplied={({ rate, voice }) => {
          toast.success(`${voice}, ${rate}로 적용했어요`);
        }}
      />
    </s.NavWrapper>
  );
};

export default Nav;
