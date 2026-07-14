import Image from "next/image"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="grid h-screen overflow-hidden lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Image src="/logo.png" alt="Clockit logo" width={18} height={18} />
            </div>
            Clockit Admin
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="hidden lg:flex flex-col items-center justify-center gap-7 bg-primary">
        <div className="flex size-32 items-center justify-center rounded-[2rem] bg-white shadow-2xl">
          <Image src="/logo.png" alt="Clockit logo" width={88} height={88} priority />
        </div>
        <div className="text-center">
          <p className="text-3xl font-semibold tracking-tight text-primary-foreground">Clockit</p>
          <p className="mt-1.5 text-sm text-primary-foreground/70">
            Attendance management for Interactive Digital
          </p>
        </div>
      </div>
    </div>
  )
}
