import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Review from "@/pages/review";
import Calculate from "@/pages/calculate";
import Form1040Page from "@/pages/form1040";
import ScheduleDPage from "@/pages/schedule-d";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/upload">
        {() => <ProtectedRoute component={Upload} />}
      </Route>
      <Route path="/review">
        {() => <ProtectedRoute component={Review} />}
      </Route>
      <Route path="/calculate">
        {() => <ProtectedRoute component={Calculate} />}
      </Route>
      <Route path="/form1040">
        {() => <ProtectedRoute component={Form1040Page} />}
      </Route>
      <Route path="/schedule-d">
        {() => <ProtectedRoute component={ScheduleDPage} />}
      </Route>
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const token = localStorage.getItem("token");
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (!token) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b bg-background">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div>
                      <h2 className="text-xl font-bold text-foreground">TaxFile Pro</h2>
                      <p className="text-xs text-muted-foreground">2024 Tax Year</p>
                    </div>
                  </div>
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto p-8 bg-background">
                  <div className="max-w-7xl mx-auto">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
