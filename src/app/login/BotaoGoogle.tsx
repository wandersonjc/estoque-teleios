export default function BotaoGoogle() {
  return (
    <a
      href="/api/auth/google"
      className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002855]"
    >
      <svg
        viewBox="0 0 48 48"
        className="h-5 w-5"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
          transform="translate(0 4)"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.66 5.94c4.47-4.13 7.11-10.2 7.11-17.59Z"
          transform="translate(0 -1)"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z"
          transform="translate(0 0)"
        />
        <path
          fill="#34A853"
          d="M24 48c6.47 0 11.9-2.13 15.87-5.8l-7.66-5.94c-2.13 1.43-4.86 2.27-8.21 2.27-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
          transform="translate(0 -4)"
        />
      </svg>
      Entrar com Google
    </a>
  );
}
