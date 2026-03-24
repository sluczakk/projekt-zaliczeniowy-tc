import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import { useEffect } from "react";
import products from "./products.json"

// test
function App() 
{
	const [count, setCount] = useState(0)

	// produkty w koszyku
	// korzystamy z cache'a by koszyk przetrwal odswiezanie strony
	const [productsInCart, setProductsInCart] = useState(() => 
	{
	  const savedCart = localStorage.getItem("cart")
	  return savedCart ? JSON.parse(savedCart) : []
	})

	// lokalne zapisywanie koszyka jesli productsInCart sie zmieni
	useEffect(() => 
	{
  	localStorage.setItem("cart", JSON.stringify(productsInCart))
	}, [productsInCart])

	// obecnie wybrany produkt (wyswietlanie szczegolow)
	const [selectedProduct, setSelectedProduct] = useState(null)

	// ilosc produktow w koszyku
	const totalItems = productsInCart.reduce((sum, item) => sum + item.quantity, 0)

	// laczna cena
	const totalPrice = productsInCart.reduce((sum, cartItem) => 
	{
		const product = products.find(
			p => p.itemid === Number(cartItem.itemid)
		)

		if (!product) return sum

		return sum + product.price * cartItem.quantity
	}, 0)

	// dodawanie do koszyka
	function addToCart(itemid) 
	{
	  const currentQty = getCartQuantity(itemid)
	  setCartQuantity(itemid, currentQty + 1)
	}

	// ustawianie ilosci produktu w koszyku
	function setCartQuantity(itemid, quantity) 
	{
	  const product = products.find(p => p.itemid === itemid)
	  if (!product) return

	  // ilosc produktu w koszyku nie moze byc wieksza niz dostepna ilosc
	  const newQuantity = Math.min(
	    product.quantity,
	    Math.max(0, quantity)
	  )

	  // jezeli nowa ilosc to 0, usuwamy z koszyka
	  if (newQuantity === 0) {
	    setProductsInCart(prev =>
	      prev.filter(p => p.itemid !== itemid)
	    )
	    return
	  }

	  // ustawiamy nowa ilosc
	  setProductsInCart(prev => {

	    const existing = prev.find(p => p.itemid === itemid)

	    if (existing) {
	      return prev.map(p =>
	        p.itemid === itemid
	          ? { ...p, quantity: newQuantity }
	          : p
	      )
	    }

	    return [...prev, { itemid, quantity: newQuantity }]
	  })
	}

	function getCartQuantity(itemid) 
	{
		const item = productsInCart.find(
			(p) => p.itemid === itemid
		)

		return item ? item.quantity : 0
	}

	function decreaseQuantity(itemid) 
	{
		setProductsInCart((prev) => {
			const existing = prev.find((p) => p.itemid === itemid)

			if (!existing) return prev

			if (existing.quantity === 1) {
				return prev.filter((p) => p.itemid !== itemid)
			}

			return prev.map((p) =>
				p.itemid === itemid
					? { ...p, quantity: p.quantity - 1 }
					: p
			)
		})
	}

	function removeFromCart(itemid) 
	{
		setProductsInCart((prev) =>
			prev.filter((p) => p.itemid !== itemid)
		)
	}

	return (
		<div className="app">
			<header className="header">
				<h1 className="logo">Vivec City Store</h1>
			</header>

			<main>

				<div className="storeLayout">

					<div className="products">
						{products.map((p) => (
							<div className={`productCard ${getCartQuantity(p.itemid) > 0 ? "productInCart" : ""}`} 
							key={p.itemid}
							onClick={() => setSelectedProduct(p)}>

								<div className="productActionsTop">

									<button
									className="removeButton"
									onClick={(e) => {
										e.stopPropagation()
										decreaseQuantity(p.itemid)
									}}
									disabled={getCartQuantity(p.itemid) === 0}
									>
										-
									</button>

									<input
										className="cartQtyInput"
										type="number"
										min="0"
										max="9999"
										value={getCartQuantity(p.itemid)}
										onClick={(e) => e.stopPropagation()}
										onChange={(e) =>
											setCartQuantity(p.itemid, Math.max(1, Number(e.target.value)))
										}
										onFocus={(e) => e.target.select()}/>

									<button
									className="addButton"
									onClick={(e) => {
										e.stopPropagation()
										addToCart(p.itemid)}}
										disabled={getCartQuantity(p.itemid) >= p.quantity}
									>
										+
									</button>

								</div>

								<img className="productImage" src={reactLogo} alt={p.title} />

								<div className="productMiddle">
									<h2 className="productTitle">{p.title}</h2>
									<p className="productDesc">{p.shortDescription}</p>
									<p className="productStock">In stock: {p.quantity}</p>
									<p className="productPrice">Price: <span className="priceHighlight">{p.price} gold</span></p>

									
								</div>

							</div>
						))}
					</div>

				<aside className="cartSidebar">

					<h1 className="cartTitle">Cart</h1>

					<div className="purchaseContainer">
						<div className="cartSummary">
							<h3>Cart Summary</h3>
							<p>Items: {totalItems}</p>
							<p>Total: <span className="priceHighlight">{totalPrice} gold</span></p>
						</div>

						<button
							className="cartPurchaseButton"
							onClick={() => addToCart(p.itemid)}
						>
							Purchase
						</button>
					</div>

					<div className="cartItems">

						{productsInCart.map(cartItem => {

							const product = products.find(
								p => p.itemid === Number(cartItem.itemid)
							)

							if (!product) return null

							return (
								<div className="cartItemContainer">

									<div key={cartItem.itemid} className="cartItem" onClick={() => setSelectedProduct(product)}>
											<div className="cartItemInfo">
												<h3 className="cartItemTitle">{product.title}</h3>
												<p className="cartItemQty">
													<span className="priceHighlight">
														{product.price * cartItem.quantity} gold 
													</span>
														{cartItem.quantity > 1 && ` (${cartItem.quantity} x ${product.price}g)`}
												</p>
											</div>

									</div>

									<div className="productActionsTop_cart">
													<button
													className="removeButton removeButton_cart"
													onClick={(e) => {
														e.stopPropagation()
														decreaseQuantity(product.itemid)
													}}
													>
														-
													</button>

													<input
														className="cartQtyInput"
														type="number"
														min="0"
														max="9999"
														value={getCartQuantity(product.itemid)}
														onClick={(e) => e.stopPropagation()}
														onChange={(e) =>
															setCartQuantity(product.itemid, Math.max(1, Number(e.target.value)))
														}
														onFocus={(e) => e.target.select()}/>

													<button
														className="addButton addButton_cart"
														onClick={(e) => {
															e.stopPropagation()
															addToCart(product.itemid)
														}}
														disabled={getCartQuantity(product.itemid) >= product.quantity}
													>
														+
													</button>
									</div>

									<button
								    className="removeCartButton"
								    onClick={() => removeFromCart(product.itemid)}
								  >
								    ✕
								  </button>
								</div>
							)
						})}

					</div>

				</aside>

				</div>

				<footer className="footer">
					<p>2026 Strona do zaliczenia PAI</p>
				</footer>

				{selectedProduct && (
					<div
						className="modalOverlay"
						onClick={() => setSelectedProduct(null)}
					>
						<div
							className="modalCard"
							onClick={(e) => e.stopPropagation()}
						>
							<button
								className="closeButton"
								onClick={() => setSelectedProduct(null)}
							>
								×
							</button>

							<img
								className="modalImage"
								src={reactLogo}
								alt={selectedProduct.title}/>

							<h2 className="modalTitle">{selectedProduct.title}</h2>

							<p className="modalShortDesc">
								{selectedProduct.shortDescription}
							</p>

							<p className="modalLongDesc">
								{selectedProduct.longDescription}
							</p>

							<p className="modalPrice">
								Price: <span className="priceHighlight">{selectedProduct.price} gold</span>
							</p>

							<p className="modalStock">
								In stock: {selectedProduct.quantity}
							</p>
						</div>
					</div>
				)}

			</main>
		</div>
	);
}

export default App

