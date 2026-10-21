import { permanentRedirect } from 'next/navigation';

export default function ProductsRedirect() {
  permanentRedirect('/shop');
}
