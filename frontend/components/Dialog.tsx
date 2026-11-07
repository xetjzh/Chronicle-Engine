import React, { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createDialogStack, getTabDestination } from './dialogBehavior';

const dialogStack = createDialogStack<symbol>();
const DialogDepth = createContext(0);
let previousBodyOverflow = '';
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe';

interface DialogProps {
  children: React.ReactNode;
  onClose: () => void;
  titleId: string;
  className?: string;
  panelClassName?: string;
}

export const Dialog: React.FC<DialogProps> = ({ children, onClose, titleId, className = '', panelClassName = '' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const tokenRef = useRef(Symbol('dialog'));
  const depth = useContext(DialogDepth);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const token = tokenRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialogStack.size === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialogStack.add(token, depth);

    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'));
    const focusFirst = () => {
      const initial = panel.querySelector<HTMLElement>('[data-autofocus]');
      (initial || controls()[0] || panel).focus({ preventScroll: true });
    };
    if (dialogStack.isTop(token)) focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!dialogStack.isTop(token) || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const elements = controls();
        const destination = getTabDestination(elements.length, elements.indexOf(document.activeElement as HTMLElement), event.shiftKey);
        if (destination !== null) {
          event.preventDefault();
          (elements[destination] || panel).focus({ preventScroll: true });
        }
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (dialogStack.isTop(token) && !panel.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      const wasTop = dialogStack.isTop(token);
      dialogStack.remove(token);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      if (dialogStack.size === 0) document.body.style.overflow = previousBodyOverflow;
      if (wasTop && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [depth]);

  return createPortal(
    <DialogDepth.Provider value={depth + 1}>
      <div className={`dialog-overlay fixed inset-0 flex items-center justify-center ${className}`} style={{ zIndex: 100 + depth }}>
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog-panel ${panelClassName}`}>
          {children}
        </div>
      </div>
    </DialogDepth.Provider>,
    document.body,
  );
};
