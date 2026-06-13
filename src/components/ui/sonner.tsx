import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border backdrop-blur-xl shadow-elevated " +
            "group-[.toaster]:bg-card/90 group-[.toaster]:text-foreground " +
            "group-[.toaster]:border-primary/20 group-[.toaster]:border-l-4",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-gradient-to-br group-[.toast]:from-primary group-[.toast]:to-primary-deep group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success: "group-[.toaster]:!border-l-success",
          error: "group-[.toaster]:!border-l-destructive",
          info: "group-[.toaster]:!border-l-primary",
          warning: "group-[.toaster]:!border-l-warning",
          closeButton:
            "group-[.toast]:bg-card group-[.toast]:border-primary/20 group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
