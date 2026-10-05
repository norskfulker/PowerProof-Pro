"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Section, Specimen } from "./_section";

const schema = z.object({
  email: z.string().email("That email looks off. Check for typos."),
  slug: z.string().min(3, "Store links need at least 3 characters."),
});

function DemoForm() {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "ananya@", slug: "an" }, mode: "onTouched" });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(() => toast.success("Saved"))}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store link</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>powerproof.store/{field.value || "your-name"}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="self-start">
          Validate
        </Button>
      </form>
    </Form>
  );
}

export function Controls() {
  return (
    <>
      <Section id="buttons" title="Buttons" description="Primary (emerald) for the one main action. Secondary for everything else. Brass is rare. 44px tall on touch.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Specimen label="Variants">
            <div className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="brass">Brass</Button>
              <Button variant="link">Link</Button>
            </div>
          </Specimen>
          <Specimen label="Sizes">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">
                Large <ArrowRight />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Add">
                <Plus />
              </Button>
            </div>
          </Specimen>
          <Specimen label="States">
            <div className="flex flex-wrap gap-2">
              <Button disabled>Disabled</Button>
              <Button disabled>
                <Loader2 className="animate-spin" /> Saving…
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
              <Button variant="danger">
                <Trash2 /> Delete
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Tab to any button to see the 2px emerald focus ring.</p>
          </Specimen>
        </div>
      </Section>

      <Section id="inputs" title="Inputs and forms" description="Labels on every field. Errors appear under the field in plain language after the field is touched.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Specimen label="Text">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-name">Store name</Label>
              <Input id="d-name" placeholder="Ananya Makes" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-err">With error</Label>
              <Input id="d-err" aria-invalid defaultValue="hello@" aria-describedby="d-err-m" />
              <p id="d-err-m" className="text-sm font-medium text-danger">That email looks off. Check for typos.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-dis">Disabled</Label>
              <Input id="d-dis" disabled defaultValue="Can't touch this" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-ta">Description</Label>
              <Textarea id="d-ta" placeholder="What's in it, who it's for." />
            </div>
          </Specimen>
          <Specimen label="Choice">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-sel">Product type</Label>
              <Select defaultValue="ebook">
                <SelectTrigger id="d-sel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ebook">Ebook</SelectItem>
                  <SelectItem value="notion">Notion kit</SelectItem>
                  <SelectItem value="preset">Presets</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <Checkbox defaultChecked /> <span className="text-sm">Email me when someone buys</span>
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm">Published</span>
              <Switch defaultChecked aria-label="Published" />
            </label>
            <RadioGroup defaultValue="bank" aria-label="Payout method">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <RadioGroupItem value="bank" /> Bank account
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
                <RadioGroupItem value="usdt" disabled /> USDT (coming soon)
              </label>
            </RadioGroup>
          </Specimen>
          <Specimen label="Validation (react-hook-form + zod)">
            <DemoForm />
          </Specimen>
        </div>
      </Section>

      <Section id="tabs" title="Tabs">
        <Specimen label="Default">
          <Tabs defaultValue="7d">
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="7d">7 days</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
            </TabsList>
            <TabsContent value="today" className="text-sm text-muted-foreground">Today&apos;s numbers.</TabsContent>
            <TabsContent value="7d" className="text-sm text-muted-foreground">The last 7 days.</TabsContent>
            <TabsContent value="30d" className="text-sm text-muted-foreground">The last 30 days.</TabsContent>
          </Tabs>
        </Specimen>
      </Section>
    </>
  );
}
