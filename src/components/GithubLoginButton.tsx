import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { GithubIcon } from "./AuthMenu";

interface Props {
  /** 登录成功后回到哪个内部路径 */
  next?: string;
  className?: string;
  label?: string;
}

/**
 * GitHub 登录按钮：
 * 点击后立即禁用并显示「正在跳转 GitHub…」，避免连点提交多次 OAuth；
 * 用户从 GitHub 页面返回（bfcache 恢复）时自动恢复可点。
 */
export function GithubLoginButton({
  next,
  className = "btn btn-primary",
  label = "使用 GitHub 登录",
}: Props) {
  const { login, loginPending, resetLoginPending } = useAuth();
  const [clicked, setClicked] = useState(false);
  const pending = clicked || loginPending;

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setClicked(false);
        resetLoginPending();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [resetLoginPending]);

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (pending) return;
        setClicked(true);
        login(next);
      }}
    >
      {pending ? (
        <>
          <span className="loading loading-spinner loading-xs" />
          正在跳转 GitHub…
        </>
      ) : (
        <>
          <GithubIcon /> {label}
        </>
      )}
    </button>
  );
}
