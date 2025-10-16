import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileText, CheckCircle2, Shield, Upload } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRegister, setIsRegister] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response;
    },
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Account created!",
        description: "Please log in with your credentials.",
      });
      setIsRegister(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Username already exists.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginInput) => {
    if (isRegister) {
      registerMutation.mutate(data);
    } else {
      loginMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              TaxFile Pro
            </h1>
            <p className="text-lg text-muted-foreground">
              Professional tax filing made simple with intelligent document parsing and automatic calculations.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Multi-Format Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Upload W-2, 1099 forms in PDF, CSV, or Excel format with drag-and-drop ease.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Intelligent Parsing</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic data extraction from tax documents with smart validation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Form 1040 Generation</h3>
                <p className="text-sm text-muted-foreground">
                  Auto-populated forms with accurate tax calculations based on 2024 tax brackets.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Secure & Private</h3>
                <p className="text-sm text-muted-foreground">
                  Your financial data is encrypted and protected with industry-standard security.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">
              {isRegister ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? "Sign up to start filing your taxes"
                : "Sign in to continue to your tax return"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter your username"
                          data-testid="input-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending || registerMutation.isPending}
                  data-testid="button-submit"
                >
                  {loginMutation.isPending || registerMutation.isPending
                    ? "Please wait..."
                    : isRegister
                    ? "Create Account"
                    : "Sign In"}
                </Button>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      form.reset();
                    }}
                    className="text-sm text-primary hover:underline"
                    data-testid="button-toggle-auth"
                  >
                    {isRegister
                      ? "Already have an account? Sign in"
                      : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
