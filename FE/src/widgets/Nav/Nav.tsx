import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContrastMode } from "@shared/useContrastMode";
import { useContrastImage } from "@shared/useContrastImage";
import * as s from "./style";
import type { NavVariant } from "./types";
import A11yModal from "@layouts/components/nav/A11yModal";
import SoundModal from "@layouts/components/nav/SoundModal";
import toast from "react-hot-toast";

type Props = { variant: NavVariant; title?: string };

/* ---------- 공통 버튼 ---------- */
const RightActions = ({
  isHC,
  onOpenA11y,
  soundSrc,
  eyeSrc,
  onOpenSound,
}: {
  isHC: boolean;
  onOpenA11y: () => void;
  soundSrc: string;
  eyeSrc: string;
  onOpenSound: () => void;
}) => (
  <>
    <s.ActionButton
      type="button"
      aria-label="음성 설정"
      title="음성 설정"
      onClick={onOpenSound}
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
    >
      <img src={eyeSrc} alt="" aria-hidden />
      <em>화면 설정</em>
    </s.ActionButton>
  </>
);

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

const Nav = ({ variant, title }: Props) => {
  const nav = useNavigate();
  const { isHC } = useContrastMode();
  const [a11yOpen, setA11yOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);

  const logo = useContrastImage("/img/nav/logo");
  const sound = useContrastImage("/img/nav/sound");
  const eye = useContrastImage("/img/nav/eye");
  const back = useContrastImage("/img/nav/back");

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
        {/* Right 없음 */}
      </s.NavWrapper>
    );
  }

  /* ---------- 2) 홈(폴더): 로고 + 탭(강의실, 시험) / 오른쪽 설정 ---------- */
  if (variant === "folder") {
    return (
      <s.NavWrapper data-variant="folder">
        <s.FolderLeft>
          <img src={logo} alt="캠퍼스 메이트 로고" />
          <s.TabNav role="tablist" aria-label="메인 탭">
            {/* 경로는 기존 라우트 유지, 라벨만 변경 */}
            <s.TabLink to="/" end>
              강의실
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
            onOpenSound={() => setSoundOpen(true)}
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

  /* ---------- 3) 수업 전/중/후: 왼쪽 뒤로가기 / 오른쪽 설정 ---------- */
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
          onOpenSound={() => setSoundOpen(true)}
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
