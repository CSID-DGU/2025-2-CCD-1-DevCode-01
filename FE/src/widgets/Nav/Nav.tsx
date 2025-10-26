import { useNavigate } from "react-router-dom";
import { useContrastMode } from "@shared/useContrastMode";
import { useContrastImage } from "@shared/useContrastImage";
import * as s from "./style";
import type { NavVariant } from "./types";

type Props = { variant: NavVariant; title?: string };

// 오른쪽 공통 액션
const RightActions = ({
  isHC,
  toggleMode,
  soundSrc,
  eyeSrc,
  onRead,
}: {
  isHC: boolean;
  toggleMode: () => void;
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
      onClick={toggleMode}
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

// 왼쪽 아이콘 버튼 (summary/record/classSummary)
const LeftIconButton = ({
  icon,
  label,
  onClick,
  expanded,
  controls,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  expanded?: boolean;
  controls?: string;
}) => (
  <s.ActionButton
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    aria-expanded={expanded}
    aria-controls={controls}
  >
    <img src={icon} alt="" aria-hidden />
    <em>{label}</em>
  </s.ActionButton>
);

const Nav = ({ variant, title }: Props) => {
  const nav = useNavigate();
  const { isHC, toggleMode } = useContrastMode();

  // 모드별 이미지
  const logo = useContrastImage("/img/nav/logo");
  const sound = useContrastImage("/img/nav/sound");
  const eye = useContrastImage("/img/nav/eye");
  const back = useContrastImage("/img/nav/back");

  // 왼쪽 추가 아이콘
  const summary = useContrastImage("/img/nav/summary"); // pre
  const record = useContrastImage("/img/nav/record"); // live
  const classSummary = useContrastImage("/img/nav/classSummary"); // post

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
            toggleMode={toggleMode}
            soundSrc={sound}
            eyeSrc={eye}
          />
        </s.Actions>
      </s.NavWrapper>
    );
  }

  // 2) 폴더(루트) 탭
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
            toggleMode={toggleMode}
            soundSrc={sound}
            eyeSrc={eye}
          />
        </s.Right>
      </s.NavWrapper>
    );
  }

  const isClassFlow = ["pre", "live", "post", "exam"].includes(variant);

  return (
    <s.NavWrapper data-variant={variant}>
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
              <LeftIconButton
                icon={record}
                label="강의녹화"
                onClick={() => {
                  // 녹화 시작/중지 토글
                }}
              />
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

      {/* Right: 고정(화면읽기/설정) */}
      <s.Right>
        <RightActions
          isHC={isHC}
          toggleMode={toggleMode}
          soundSrc={sound}
          eyeSrc={eye}
          onRead={() => {
            // 스크린리더용 읽기 기능 (TTS 등)
          }}
        />
      </s.Right>
    </s.NavWrapper>
  );
};

export default Nav;
