"use client";

import { useState } from "react";
import { HelpCircle, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusPill } from "@/components/pp/status-pill";
import { Badge } from "@/components/ui/badge";
import { Section, Specimen } from "./_section";

export function Overlays() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 5));
  return (
    <>
      <Section id="pills" title="Status pills and badges" description="The only fully rounded shape in the product.">
        <div className="flex flex-wrap gap-2">
          {["paid", "pending", "refund_requested", "refunded", "failed", "published", "draft", "processing", "on_hold", "trial", "coming_soon", "connected"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>Primary</Badge>
          <Badge variant="brass">Brass</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </Section>

      <Section id="feedback" title="Feedback" description="Toasts for quick confirmation. Dialogs only for destructive actions.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Specimen label="Toasts">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => toast.success("Product published", { description: "It's live on your store." })}>Success</Button>
              <Button variant="secondary" onClick={() => toast.error("Couldn't save", { description: "Check your connection and try again." })}>Error</Button>
              <Button variant="secondary" onClick={() => toast("Link copied")}>Neutral</Button>
            </div>
          </Specimen>
          <Specimen label="Dialog (destructive only)">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="danger" className="self-start">Refund order</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Refund ₹1,499.00?</DialogTitle>
                  <DialogDescription>The buyer gets their money back in 5–7 days and loses download access. This can&apos;t be undone.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Keep order</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger" onClick={() => toast.success("Refund started")}>Refund</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" className="self-start">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Sheets slide in for secondary tasks on mobile.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </Specimen>
          <Specimen label="Menus, popover, tooltip">
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">Popover</Button>
                </PopoverTrigger>
                <PopoverContent className="text-sm">Popovers get the one soft shadow.</PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="What's a SKU?"><HelpCircle /></Button>
                </TooltipTrigger>
                <TooltipContent>A short code you use to track a product.</TooltipContent>
              </Tooltip>
            </div>
          </Specimen>
          <Specimen label="Loading">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Progress value={62} aria-label="Upload progress" />
          </Specimen>
          <Specimen label="Accordion">
            <Accordion type="single" collapsible>
              <AccordionItem value="a">
                <AccordionTrigger>When do I get paid?</AccordionTrigger>
                <AccordionContent>Two days after each sale, the money becomes available to withdraw.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Do buyers need an account?</AccordionTrigger>
                <AccordionContent>No. They pay and download.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Specimen>
          <Specimen label="Navigation bits">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#">Products</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Second Brain</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Pagination>
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
                <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
                <PaginationItem><PaginationNext href="#" /></PaginationItem>
              </PaginationContent>
            </Pagination>
            <div className="flex gap-2">
              <Avatar><AvatarFallback className="bg-accent-soft text-accent-ink">AR</AvatarFallback></Avatar>
              <Avatar><AvatarFallback className="bg-primary-soft text-primary">KR</AvatarFallback></Avatar>
            </div>
          </Specimen>
          <Specimen label="Calendar" className="lg:col-span-2">
            <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-card border" />
          </Specimen>
        </div>
      </Section>
    </>
  );
}
