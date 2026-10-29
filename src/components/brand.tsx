import Image from "next/image";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`brand ${dark ? "on-dark" : ""}`}>
      <Image src="/brand-mark.png" alt="" width={42} height={48} priority />
      <span>
        QUALITY
        <br />
        HOUSEWRAP<small>OPERATIONS</small>
      </span>
    </div>
  );
}
