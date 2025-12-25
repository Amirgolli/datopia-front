import { Button } from "@/components/ui/button";
import Link from "next/link";
import Telegram from "../../public/svg/Telegram";
import Google from "../../public/svg/Google";
import Linkdin from "../../public/svg/Linkdin";
import Instagram from "../../public/svg/Instagram";
import Logo from "../../public/svg/Logo";

const footerLinks = [
  {
    title: "امکانات",
    href: "#features",
  },
  {
    title: "قیمت گذاری",
    href: "#pricing",
  },
  {
    title: "سوالات پرتکرار",
    href: "#faq",
  },
  {
    title: "نظرات مشتریان",
    href: "#testimonials",
  },
  {
    title: "قوانین و مقررات",
    href: "#privacy",
  },
];

const Footer = () => {
  return (
    <footer className="   bg-[#747375] text-foreground">
      <div className=" px-4 sm:px-6 lg:px-10 ">
        <div className="py-12 flex flex-col sm:flex-row items-start justify-between gap-x-8 gap-y-10 px-6 xl:px-0">
          <div className="">
            <div className="flex items-center gap-2">
              <Logo height={45} width={45} />
              <h4 className="text-white">دیتوپیا</h4>
            </div>
            <ul className="mt-6 flex items-center gap-4 flex-wrap">
              {footerLinks.map(({ title, href }) => (
                <li key={title}>
                  <Link
                    href={href}
                    className=" text-[#ffffff98] hover:text-white"
                  >
                    {title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <Button
              className="bg-white text-black cursor-pointer"
              variant={"ghost"}
              asChild
            >
              <a href="tel:+989123456789">تماس با پشتیبانی و فروش</a>
            </Button>
          </div>
        </div>
        <div className="py-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-x-2 gap-y-5 px-6 xl:px-0">
          {/* Copyright */}
          <span className=" text-white text-center sm:text-start">
            کلیه حقوق مادی و معنوی این وب‌سایت متعلق به تیم دیتوپیا می‌باشد 
          </span>

          <div className="flex items-center  gap-8 text-muted-foreground">
            <Link href="#" target="_blank">
              <Telegram />
            </Link>
            <Link href="mailto:t.hosseinpour2347@gmail.com" target="_blank">
              <Google />
            </Link>
            <Link href="#" target="_blank">
              <Linkdin />
            </Link>
            <Link href="#" target="_blank">
              <Instagram />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
