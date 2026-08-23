"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * নতুন কম্পোনেন্ট (২১ আগস্ট ২০২৬, ব্যবহারকারীর ফিডব্যাক): ডেস্কটপে সাইডবার
 * যেমন একটা প্যানেল, মোবাইলে "মেনু" বাটনে ট্যাপ করলে dialog.tsx-এর মতো
 * মাঝখানে popup না খুলে — এখন এই Sheet কম্পোনেন্ট ব্যবহার করে **পাশ থেকে
 * স্লাইড করে বের হয়** (ডেস্কটপ সাইডবারের অবস্থানের সাথে সামঞ্জস্যপূর্ণভাবে
 * বাম দিক থেকে), আবার বন্ধ করলে পাশেই স্লাইড করে ঢুকে যায় — এটাই বেশিরভাগ
 * professional মোবাইল অ্যাপের নেভিগেশন-ড্রয়ার প্যাটার্ন।
 *
 * dialog.tsx-এর মতোই একই Radix Dialog primitive ব্যবহার করে (accessible:
 * focus-trap, Escape-এ বন্ধ, বাইরে ট্যাপে বন্ধ — সবকিছু বিনামূল্যে পাওয়া
 * যায়), শুধু positioning/animation ক্লাস আলাদা — কোনো নতুন npm প্যাকেজ
 * লাগেনি।
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "left" | "right";
}

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, children, side = "left", ...props }, ref) => {
    const t = useTranslations("common");
    return (
      <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed inset-y-0 z-50 flex w-[82%] max-w-xs flex-col bg-white shadow-card-hover",
            side === "left"
              ? "left-0 border-r border-neutral-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300"
              : "right-0 border-l border-neutral-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300",
            className
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none">
            <X className="h-5 w-5" />
            <span className="sr-only">{t("close")}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("border-b border-neutral-100 px-4 py-4", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold text-neutral-900", className)} {...props} />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle };
