import {
  useEffect,
  useState,
} from "react";

import "./BackToTopButton.css";

const SHOW_AFTER_PIXELS = 320;

function BackToTopButton() {
  const [
    isVisible,
    setIsVisible,
  ] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(
        window.scrollY >
          SHOW_AFTER_PIXELS,
      );
    }

    updateVisibility();

    window.addEventListener(
      "scroll",
      updateVisibility,
      {
        passive: true,
      },
    );

    return () => {
      window.removeEventListener(
        "scroll",
        updateVisibility,
      );
    };
  }, []);

  function handleClick() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      className="back-to-top-button"
      aria-label="Back to top"
      title="Back to top"
      onClick={handleClick}
    >
      <span
        aria-hidden="true"
        className="back-to-top-arrow"
      >
        ↑
      </span>
    </button>
  );
}

export default BackToTopButton;