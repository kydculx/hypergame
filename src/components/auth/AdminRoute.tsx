import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '../../hooks/useUserStore';

interface AdminRouteProps {
    children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const isAdmin = useUserStore((state) => state.isAdmin);

    // If still loading auth state, we might show a loader. 
    // But for simplicity, we check if not admin and redirect.
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
