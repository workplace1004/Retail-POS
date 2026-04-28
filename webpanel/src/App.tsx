import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Reports from "./pages/Reports.tsx";
import Users from "./pages/Users.tsx";
import Registers from "./pages/Registers.tsx";
import Customers from "./pages/Customers.tsx";
import Invoicing from "./pages/Invoicing.tsx";

import Webshop from "./pages/Webshop.tsx";
import PriceScreens from "./pages/PriceScreens.tsx";
import Vouchers from "./pages/Vouchers.tsx";
import Production from "./pages/Production.tsx";
import Suppliers from "./pages/Suppliers.tsx";
import Labels from "./pages/Labels.tsx";
import Account from "./pages/Account.tsx";
import Profile from "./pages/Profile.tsx";
import Help from "./pages/Help.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/registers" element={<Registers />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/invoicing" element={<Invoicing />} />
                  <Route path="/webshop" element={<Webshop />} />
                  <Route path="/price-screens" element={<PriceScreens />} />
                  <Route path="/vouchers" element={<Vouchers />} />
                  <Route path="/production" element={<Production />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/labels" element={<Labels />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
