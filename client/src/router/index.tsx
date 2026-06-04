import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import { HomePage } from '../pages/HomePage';
import { DesignerPage } from '../pages/DesignerPage';
import { ProductsPage } from '../pages/ProductsPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { OrderPage } from '../pages/OrderPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { MyWorksPage } from '../pages/MyWorksPage';
import { AuthGuard } from '../components/AuthGuard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'designer', element: <DesignerPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'my-works', element: <AuthGuard><MyWorksPage /></AuthGuard> },
      { path: 'orders', element: <AuthGuard><OrderPage /></AuthGuard> },
      { path: 'checkout', element: <AuthGuard><CheckoutPage /></AuthGuard> },
    ],
  },
]);
