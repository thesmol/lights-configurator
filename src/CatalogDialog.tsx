import { useEffect, useId, useRef, type ReactNode } from "react";
export default function CatalogDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[85vh] w-[min(800px,92vw)] overflow-y-auto rounded-xl bg-white p-0 shadow-2xl backdrop:bg-[#17221b66]"
    >
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Закрыть каталог"
            className="grid size-9 place-items-center rounded text-2xl text-[#839176] hover:bg-[#edf1e7]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
