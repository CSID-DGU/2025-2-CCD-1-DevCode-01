let _scrollY = 0;

export function lockBodyScroll() {
  _scrollY = window.scrollY || 0;
  Object.assign(document.body.style, {
    position: "fixed",
    top: `-${_scrollY}px`,
    left: "0",
    right: "0",
    width: "100%",
    overflow: "hidden",
    touchAction: "none",
  } as CSSStyleDeclaration);
}

export function unlockBodyScroll() {
  Object.assign(document.body.style, {
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    overflow: "",
    touchAction: "",
  } as CSSStyleDeclaration);
  window.scrollTo(0, _scrollY);
}
