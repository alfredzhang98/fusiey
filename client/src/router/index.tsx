import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import { HomePage } from '../pages/HomePage';
import { DesignerPage } from '../pages/DesignerPage';
import { ProductsPage } from '../pages/ProductsPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LegalPage } from '../pages/LegalPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { OrderPage } from '../pages/OrderPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { MyWorksPage } from '../pages/MyWorksPage';
import { CustomOrderPage } from '../pages/CustomOrderPage';
import { AdminPage } from '../pages/AdminPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AuthGuard } from '../components/AuthGuard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'designer', element: <DesignerPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'profile', element: <AuthGuard><ProfilePage /></AuthGuard> },
      { path: 'my-works', element: <AuthGuard><MyWorksPage /></AuthGuard> },
      { path: 'custom-order', element: <AuthGuard><CustomOrderPage /></AuthGuard> },
      { path: 'orders', element: <AuthGuard><OrderPage /></AuthGuard> },
      { path: 'checkout', element: <AuthGuard><CheckoutPage /></AuthGuard> },
      { path: 'admin', element: <AuthGuard><AdminPage /></AuthGuard> },
      { path: 'legal/:slug', element: <LegalPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
