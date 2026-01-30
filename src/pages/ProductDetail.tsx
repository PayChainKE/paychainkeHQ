import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Share2, Star } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Mock product data - in a real app, this would come from an API
  const products: Product[] = [
    {
      id: 1,
      name: 'PayChain Tech T-Shirt',
      description: 'Minimal blockchain pattern with PayChainKE logo. Premium cotton, perfect for developers.',
      price: 2500,
    },
    {
      id: 2,
      name: 'Validator Hoodie',
      description: 'Comfortable sweatshirt with "Secure. Verify. Trust." slogan. Ideal for cold Nairobi nights.',
      price: 4500,
    },
    {
      id: 3,
      name: 'Truth Layer Cap',
      description: 'Adjustable snapback with embroidered PayChain logo. UV protection for outdoor coding sessions.',
      price: 1800,
    },
    {
      id: 4,
      name: 'Blockchain Tote Bag',
      description: 'Eco-friendly canvas tote with minimal crypto design. Perfect for carrying your laptop to meetups.',
      price: 1200,
    },
    {
      id: 5,
      name: 'Consensus Socks',
      description: 'Comfy cotton socks with blockchain node pattern. Because great developers need great foundations.',
      price: 800,
    },
    {
      id: 6,
      name: 'PayChain Stickers Pack',
      description: '10 premium vinyl stickers with various PayChain designs. Decorate your laptop, water bottle, or anywhere!',
      price: 500,
    },
    {
      id: 7,
      name: 'Insulated Water Bottle',
      description: 'Double-wall stainless steel bottle keeps drinks cold for 24hrs. Perfect for long coding sessions.',
      price: 2200,
    },
    {
      id: 8,
      name: 'Crypto Tumbler',
      description: 'Travel mug with blockchain-inspired design. Keeps coffee hot and your crypto knowledge fresh.',
      price: 1600,
    },
    {
      id: 9,
      name: 'Smart Notebook',
      description: 'Digital notebook that scans and digitizes your notes. Perfect for brainstorming blockchain ideas.',
      price: 3500,
    },
    {
      id: 10,
      name: 'RFID Card Holder',
      description: 'Slim wallet with RFID blocking technology. Protects your crypto cards from digital pickpocketing.',
      price: 1400,
    },
    {
      id: 11,
      name: 'Full Zip Puff Jacket',
      description: 'Insulated puff jacket with full zipper. Perfect for Nairobi\'s variable weather and late-night coding sessions.',
      price: 5200,
    },
    {
      id: 12,
      name: 'Half Zip Puff Jacket',
      description: 'Stylish half-zip puff jacket with blockchain-inspired design. Layer perfectly over your PayChain t-shirt.',
      price: 4800,
    },
  ];

  const product = products.find(p => p.id === parseInt(id || '0'));

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <button
            onClick={() => navigate('/store')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Back to Store
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const addToCart = () => {
    // In a real app, this would add to cart
    alert(`Added ${product.name} to cart!`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Back Button */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <button
            onClick={() => navigate('/store')}
            className="flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors duration-200 border border-gray-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <img
                src="/logo 1.png"
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Thumbnail images would go here */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded border-2 border-gray-200 cursor-pointer hover:border-blue-500">
                  <img
                    src="/logo 1.png"
                    alt={`${product.name} ${i}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">(4.8) 127 reviews</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-4">KES {product.price.toLocaleString()}</div>
            </div>

            {/* Key Features */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Key Features</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Premium quality materials</li>
                <li>• PayChain branded design</li>
                <li>• Perfect for developers and tech enthusiasts</li>
                <li>• Limited edition release</li>
              </ul>
            </div>

            {/* Quantity and Actions */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Quantity:</label>
                <select className="border border-gray-300 rounded px-3 py-1">
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={addToCart}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <ShoppingCart className="w-5 h-5 inline mr-2" />
                  Add to Cart
                </button>
                <button className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Heart className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Share2 className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Delivery & Returns</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Standard Delivery</span>
                  <span>FREE (2-3 days)</span>
                </div>
                <div className="flex justify-between">
                  <span>Express Delivery</span>
                  <span>KES 300 (1 day)</span>
                </div>
                <div className="flex justify-between">
                  <span>Nairobi Pickup</span>
                  <span>FREE (Same day)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Description */}
        <div className="mt-12 bg-white rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Description</h2>
          <p className="text-gray-700 leading-relaxed mb-6">{product.description}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Specifications</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Material: Premium quality</li>
                <li>• Brand: PayChain</li>
                <li>• Origin: Kenya</li>
                <li>• Care: Machine washable</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What's in the Box</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• 1 x {product.name}</li>
                <li>• Care instructions</li>
                <li>• PayChain branded packaging</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-8 bg-white rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Reviews</h2>
          <div className="space-y-4">
            {[1].map((review) => (
              <div key={review} className="border-b pb-4 last:border-b-0">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm font-medium">John Doe</span>
                  <span className="text-sm text-gray-500">2 weeks ago</span>
                </div>
                <p className="text-gray-700">Great product! Love the PayChain branding and the quality is excellent.</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProductDetail;