import { Icon } from "@/components/ui/icon";

export function TrustFooter() {
  return (
    <>
      <div className="w-full flex items-center justify-between px-2 pt-5 pb-2">
        <div className="flex items-center gap-2 text-text-secondary font-body-sm text-body-sm">
          <Icon name="verified_user" className="text-tertiary text-[18px]" />
          <span>GDPR &amp; ISO 27001 compliant</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary font-body-sm text-body-sm">
          <Icon name="hub" className="text-primary-container text-[18px]" />
          <span>EU sovereign infrastructure</span>
        </div>
      </div>
      <footer className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-text-tertiary font-body-sm text-body-sm">
        <div className="flex items-center gap-4">
          <a className="hover:text-text-secondary transition-colors" href="#">
            Security &amp; Encryption
          </a>
          <span>•</span>
          <a className="hover:text-text-secondary transition-colors" href="#">
            24/7 Support
          </a>
          <span>•</span>
          <a className="hover:text-text-secondary transition-colors" href="#">
            Privacy Policy
          </a>
        </div>
        <div className="flex items-center bg-surface-container-lowest rounded-full p-0.5 shadow-sm">
          <button
            type="button"
            className="px-2.5 py-1 rounded-full font-label-md text-label-md text-text-secondary hover:text-text-primary transition-colors"
          >
            FR
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded-full font-label-md text-label-md bg-secondary-container text-on-secondary-fixed font-bold"
          >
            EN
          </button>
        </div>
      </footer>
    </>
  );
}
