export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
}

export interface Event {
  id: string;
  clientId: string;
  name: string;
  date: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  guestCount: number;
}

export interface Vianda {
  id: string;
  name: string;
  description: string;
  price: number;
}
