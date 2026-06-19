// --- VARIÁVEIS GLOBAIS ---
let allProducts = [];
let allCategories = [];
let cart = [];
let activeCategory = 'Todos';
let scrollTimeout;

// --- FUNÇÕES DE PERSISTÊNCIA DO CARRINHO ---
function saveCart() {
    // Converter formato para compatibilidade com carrinho.php
    const carrinhoFormatado = cart.map(item => ({
        nome: item.name,
        preco: `R$ ${item.newPrice.toFixed(2).replace('.', ',')}`,
        imagem: item.image ? item.image.replace(/\?v=\d+/, '') : 'images/placeholder.png', // Remove cache bust e garante caminho limpo
        quantidade: item.quantity || 1,
        id: item.id
    }));
    localStorage.setItem('carrinho', JSON.stringify(carrinhoFormatado));
}

function loadCart() {
    const savedCart = localStorage.getItem('carrinho');
    if (savedCart) {
        try {
            const carrinhoSalvo = JSON.parse(savedCart);
            // Converter de volta para formato interno
            cart = carrinhoSalvo.map(item => {
                const product = allProducts.find(p => p.id === item.id);
                if (product) {
                    return {
                        ...product,
                        quantity: item.quantidade || 1
                    };
                }
                // Fallback se produto não encontrado
                return {
                    id: item.id,
                    name: item.nome,
                    newPrice: parseFloat(item.preco.replace('R$', '').replace(',', '.').trim()),
                    image: item.imagem,
                    quantity: item.quantidade || 1
                };
            });
            renderCart();
        } catch (e) {
            console.error('Erro ao carregar carrinho:', e);
            cart = [];
        }
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO E CONTROLE DE VIEW ---

function switchView(view, categoryName = null, productIdToHighlight = null) {
    const homeView = document.getElementById('home-view-container');
    const categoryView = document.getElementById('category-page-container');
    const reviewsView = document.getElementById('reviews');

    // Esconde todas as views
    homeView.classList.add('hidden');
    categoryView.classList.add('hidden');
    reviewsView.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'home') {
        homeView.classList.remove('hidden');
        reviewsView.style.display = 'block';
        activeCategory = 'Todos';
    } else if (view === 'category') {
        renderCategoryPage(categoryName, productIdToHighlight);
        categoryView.classList.remove('hidden');
        activeCategory = categoryName;
    } else if (view === 'reviews') {
        reviewsView.style.display = 'block';
        activeCategory = 'Avaliações';
    }
    
    // Atualiza a navegação
    document.querySelectorAll('.category-link, .category-grid-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`[data-category="${activeCategory}"]`).forEach(el => el.classList.add('active'));
}

function renderCategoryPage(categoryName, productIdToHighlight = null) {
    const container = document.getElementById('category-page-container');
    const products = allProducts.filter(p => p.category === categoryName);

    let productsHTML = products.map(product => {
        const isOutOfStock = product.stock <= 0;
        const cardClasses = isOutOfStock ? 'opacity-50 cursor-not-allowed' : '';
        const buttonDisabled = isOutOfStock ? 'disabled' : '';
        const outOfStockBadge = isOutOfStock ? '<div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">Esgotado</div>' : '';

        return `
            <div id="product-card-${product.id}" class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col relative ${cardClasses}">
                ${outOfStockBadge}
                <figure class="w-full h-40 bg-white p-2 cursor-pointer product-image-figure" data-image-src="${product.image}?v=2" data-image-alt="${product.name.replace(/"/g, '&quot;')}">
                    <img src="${product.image}?v=2" alt="${product.name}" class="w-full h-full object-contain" loading="lazy">
                </figure>
                <div class="p-3 flex flex-col flex-grow">
                    <div class="flex-grow mb-2">
                        <h3 class="text-sm font-semibold text-gray-800">${product.name}</h3>
                    </div>
                    <div class="flex justify-between items-center">
                        <div>
                            ${product.oldPrice > 0 ? `<p class="text-xs text-gray-500 line-through">R$ ${product.oldPrice.toFixed(2).replace('.',',')}</p>` : ''}
                            <p class="text-lg font-bold text-gray-900">R$ ${product.newPrice.toFixed(2).replace('.',',')}</p>
                        </div>
                        <button onclick="addToCart(${product.id})" ${buttonDisabled} class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-transform hover:scale-110 shadow shrink-0 disabled:bg-gray-400 disabled:hover:scale-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="flex items-center mb-6">
            <button onclick="switchView('home')" class="p-2 rounded-full hover:bg-gray-200 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-gray-700"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900">${categoryName}</h2>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${productsHTML}
        </div>
    `;

    if (productIdToHighlight) {
        setTimeout(() => {
            const productElement = document.getElementById(`product-card-${productIdToHighlight}`);
            if (productElement) {
                productElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                productElement.classList.add('highlight-product');
            }
        }, 100);
    }
}

function renderAllCarousels() {
    const carouselsContainer = document.getElementById('carousels-container');
    if (!carouselsContainer) return;
    carouselsContainer.innerHTML = '';
    
    allCategories.forEach(category => {
        if (category.name === 'Avaliações') return;
        const productsForCategory = allProducts.filter(p => p.category === category.name);
        if (productsForCategory.length > 0) {
            const section = document.createElement('section');
            section.id = `category-section-${category.name.replace(/\s+|&/g, '-')}`;
            section.className = 'mb-12';
            
            let carouselHTML = `
                <div class="flex justify-between items-center mb-4 px-4">
                    <h2 class="text-2xl md:text-3xl font-bold text-gray-900">${category.name}</h2>
                    <a href="#" onclick="event.preventDefault(); switchView('category', '${category.name}')" class="text-amber-600 font-semibold text-sm hover:underline">Ver mais</a>
                </div>
                <div class="flex overflow-x-auto scrollbar-hide space-x-4 pb-4 px-4">
            `;

            productsForCategory.slice(0, 9).forEach(product => {
                const tagsHTML = product.tags.slice(0, 1).map(tag => {
                    const colorClasses = {
                        blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800',
                        red: 'bg-red-100 text-red-800', purple: 'bg-purple-100 text-purple-800', gray: 'bg-gray-100 text-gray-800'
                    };
                    return `<span class="text-xs font-semibold ${colorClasses[tag.color] || 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded-full">${tag.text}</span>`
                }).join('');
                
                const isOutOfStock = product.stock <= 0;
                const cardClasses = isOutOfStock ? 'opacity-50 cursor-not-allowed' : '';
                const buttonDisabled = isOutOfStock ? 'disabled' : '';
                const outOfStockBadge = isOutOfStock ? '<div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">Esgotado</div>' : '';

                carouselHTML += `
                    <div class="flex-shrink-0 w-40 bg-white rounded-lg shadow-md overflow-hidden group flex flex-col relative ${cardClasses}">
                        ${outOfStockBadge}
                        <figure class="w-full h-32 bg-white relative cursor-pointer product-image-figure" data-image-src="${product.image}?v=2" data-image-alt="${product.name.replace(/"/g, '&quot;')}">
                            <img src="${product.image}?v=2" alt="${product.name}" class="w-full h-full object-contain p-2" loading="lazy">
                            <div class="absolute top-2 left-2 flex flex-col space-y-1 pointer-events-none">${tagsHTML}</div>
                        </figure>
                        <div class="p-3 flex flex-col flex-grow">
                            <div class="flex-grow h-14">
                                <h3 class="text-sm font-normal text-gray-800">${product.name}</h3>
                            </div>
                            <div class="mt-1 flex justify-between items-center">
                                <div>
                                    ${product.oldPrice > 0 ? `<p class="text-xs text-gray-500 line-through">R$ ${product.oldPrice.toFixed(2).replace('.',',')}</p>` : ''}
                                    <p class="text-md font-bold text-gray-900">R$ ${product.newPrice.toFixed(2).replace('.',',')}</p>
                                </div>
                                <button onclick="addToCart(${product.id})" ${buttonDisabled} class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-transform hover:scale-110 shadow shrink-0 disabled:bg-gray-400 disabled:hover:scale-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            carouselHTML += `
                <a href="#" onclick="event.preventDefault(); switchView('category', '${category.name}')" class="flex-shrink-0 w-40 bg-white rounded-lg shadow-md overflow-hidden flex flex-col items-center justify-center text-center p-4 hover:bg-gray-50 transition-colors">
                    <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                        <svg class="w-6 h-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    </div>
                    <p class="font-semibold text-sm text-amber-600">Ver todos</p>
                </a>
            `;

            carouselHTML += `</div>`;
            section.innerHTML = carouselHTML;
            carouselsContainer.appendChild(section);
        }
    });

    // Seção especial: Mansão Maromba
    const marombaProducts = allProducts.filter(p => p.name.includes('Mansão Maromba'));
    if (marombaProducts.length > 0) {
        const marombaSection = document.createElement('section');
        marombaSection.id = 'category-section-Mansao-Maromba';
        marombaSection.className = 'mb-12';
        
        let marombaHTML = `
            <div class="flex justify-between items-center mb-4 px-4">
                <h2 class="text-2xl md:text-3xl font-bold text-gray-900">🔥 Mansão Maromba</h2>
                <a href="#" onclick="event.preventDefault(); switchView('category', 'Drinks Prontos')" class="text-amber-600 font-semibold text-sm hover:underline">Ver mais</a>
            </div>
            <div class="flex overflow-x-auto scrollbar-hide space-x-4 pb-4 px-4">
        `;

        marombaProducts.slice(0, 9).forEach(product => {
            const tagsHTML = product.tags.slice(0, 1).map(tag => {
                const colorClasses = {
                    blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800',
                    red: 'bg-red-100 text-red-800', purple: 'bg-purple-100 text-purple-800', gray: 'bg-gray-100 text-gray-800'
                };
                return `<span class="text-xs font-semibold ${colorClasses[tag.color] || 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded-full">${tag.text}</span>`
            }).join('');
            
            const isOutOfStock = product.stock <= 0;
            const cardClasses = isOutOfStock ? 'opacity-50 cursor-not-allowed' : '';
            const buttonDisabled = isOutOfStock ? 'disabled' : '';
            const outOfStockBadge = isOutOfStock ? '<div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">Esgotado</div>' : '';

            marombaHTML += `
                <div class="flex-shrink-0 w-40 bg-white rounded-lg shadow-md overflow-hidden group flex flex-col relative ${cardClasses}">
                    ${outOfStockBadge}
                    <figure class="w-full h-32 bg-white relative cursor-pointer product-image-figure" data-image-src="${product.image}?v=2" data-image-alt="${product.name.replace(/"/g, '&quot;')}">
                        <img src="${product.image}?v=2" alt="${product.name}" class="w-full h-full object-contain p-2" loading="lazy">
                        <div class="absolute top-2 left-2 flex flex-col space-y-1 pointer-events-none">${tagsHTML}</div>
                    </figure>
                    <div class="p-3 flex flex-col flex-grow">
                        <div class="flex-grow h-14">
                            <h3 class="text-sm font-normal text-gray-800">${product.name}</h3>
                        </div>
                        <div class="mt-1 flex justify-between items-center">
                            <div>
                                ${product.oldPrice > 0 ? `<p class="text-xs text-gray-500 line-through">R$ ${product.oldPrice.toFixed(2).replace('.',',')}</p>` : ''}
                                <p class="text-md font-bold text-gray-900">R$ ${product.newPrice.toFixed(2).replace('.',',')}</p>
                            </div>
                            <button onclick="addToCart(${product.id})" ${buttonDisabled} class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-transform hover:scale-110 shadow shrink-0 disabled:bg-gray-400 disabled:hover:scale-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        marombaHTML += `
            <a href="#" onclick="event.preventDefault(); switchView('category', 'Drinks Prontos')" class="flex-shrink-0 w-40 bg-white rounded-lg shadow-md overflow-hidden flex flex-col items-center justify-center text-center p-4 hover:bg-gray-50 transition-colors">
                <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                    <svg class="w-6 h-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </div>
                <p class="font-semibold text-sm text-amber-600">Ver todos</p>
            </a>
        `;

        marombaHTML += `</div>`;
        marombaSection.innerHTML = marombaHTML;
        carouselsContainer.appendChild(marombaSection);
    }

    const ofertasSection = document.getElementById('category-section-Ofertas');
    if (ofertasSection) {
        const bannerHTML = `
            <section id="custom-banner-container" class="my-12 px-4">
                <a href="#" title="Clique para ver a promoção">
                    <img src="bannermeio2.jpg" 
                         alt="Banner Promocional" 
                         class="w-full h-auto rounded-xl">
                </a>
            </section>
        `;
        ofertasSection.insertAdjacentHTML('afterend', bannerHTML);
    }
}

function renderCategoryGrid() {
    const categoryGrid = document.getElementById('category-grid-container');
    if (!categoryGrid) return;

    let gridHTML = `<div class="grid grid-flow-col grid-rows-2 gap-x-4 gap-y-2">`;
    allCategories.forEach(category => {
        gridHTML += `
            <div class="text-center cursor-pointer category-grid-item flex-shrink-0 w-20" data-category="${category.name}" onclick="handleCategoryClick('${category.name}')">
                <div class="bg-white border-2 border-transparent rounded-lg w-16 h-16 mx-auto flex items-center justify-center overflow-hidden mb-1 transition-all duration-200">
                    <img src="${category.image_url}" alt="${category.name}" class="w-full h-full object-cover" loading="lazy">
                </div>
                <p class="text-sm font-semibold text-gray-800 transition-colors truncate">${category.name}</p>
            </div>
        `;
    });
    gridHTML += `</div>`;
    categoryGrid.innerHTML = gridHTML;
}

function renderCategoryNav() {
    const categoryNav = document.getElementById('category-nav-links');
    if (!categoryNav) return;
    const categoriesForNav = ['Todos', ...allCategories.map(c => c.name)];
    
    categoryNav.innerHTML = categoriesForNav.map(categoryName => `
        <a href="#" class="category-link shrink-0 whitespace-nowrap text-sm px-4 py-3 hover:opacity-100 transition-opacity duration-200 ${categoryName === activeCategory ? 'active' : ''}" data-category="${categoryName}">${categoryName}</a>
    `).join('');

    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleCategoryClick(link.dataset.category);
        });
    });
}

function renderSearchResults(results) {
    const searchResultsContainer = document.getElementById('search-results');
    if (!searchResultsContainer) return;
    if (results.length === 0) {
        searchResultsContainer.innerHTML = '';
        searchResultsContainer.classList.add('hidden');
        return;
    }
    const resultsHTML = results.map(product => `
        <a href="#" onclick="event.preventDefault(); goToProduct(${product.id})" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-amber-100">
            <img src="${product.image}" alt="${product.name}" class="w-10 h-10 object-contain mr-3 rounded">
            <span>${product.name}</span>
        </a>
    `).join('');
    searchResultsContainer.innerHTML = `<div class="bg-white rounded-md shadow-lg border border-gray-200 py-1">${resultsHTML}</div>`;
    searchResultsContainer.classList.remove('hidden');
}

// --- LÓGICA DO CARRINHO ---

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product || product.stock <= 0) {
        Swal.fire({ icon: 'error', title: 'Oops...', text: 'Este produto est esgotado!', timer: 1500, showConfirmButton: false });
        return;
    }
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    saveCart();
    renderCart();
    expandCart();
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;
    cartItem.quantity += change;
    if (cartItem.quantity <= 0) {
        cart = cart.filter(item => item.id !== productId);
    }
    saveCart();
    renderCart();
}

function renderCart() {
    const cartContainer = document.getElementById('shopping-cart-container');
    const cartItemsList = document.getElementById('cart-items-list');
    if (cart.length === 0) {
        cartContainer.classList.add('translate-y-full');
        return;
    }
    cartContainer.classList.remove('translate-y-full');
    let totalItems = 0;
    let totalPrice = 0;
    cartItemsList.innerHTML = '';
    cart.forEach(item => {
        totalItems += item.quantity;
        totalPrice += item.newPrice * item.quantity;
        cartItemsList.innerHTML += `
            <div class="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                    <p class="font-semibold text-sm">${item.name}</p>
                    <p class="text-xs text-gray-600">R$ ${item.newPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="updateQuantity(${item.id}, -1)" class="w-6 h-6 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300">-</button>
                    <span class="font-bold">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)" class="w-6 h-6 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300">+</button>
                </div>
            </div>`;
    });
    const formattedTotal = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
    document.getElementById('cart-total-expanded').textContent = formattedTotal;
    document.getElementById('cart-total-collapsed').textContent = formattedTotal;
    document.getElementById('cart-item-count-collapsed').textContent = totalItems;
}

function expandCart() {
    document.getElementById('cart-content').classList.remove('collapsed');
}

function collapseCart() {
    document.getElementById('cart-content').classList.add('collapsed');
}

// --- LÓGICA DE NAVEGAÇÃO E BUSCA ---

function goToCheckout() {
    const MINIMUM_ORDER_VALUE = 20;
    const total = cart.reduce((acc, item) => acc + (item.newPrice * item.quantity), 0);

    if (total < MINIMUM_ORDER_VALUE) {
        Swal.fire({
            icon: 'warning',
            title: 'Pedido Mínimo',
            html: `O valor mínimo para finalizar o pedido é de <strong>R$ ${MINIMUM_ORDER_VALUE.toFixed(2).replace('.', ',')}</strong>.`,
            confirmButtonColor: '#f59e0b'
        });
        return;
    }

    const checkoutCart = cart.map(item => ({
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        price: Math.round(item.newPrice * 100)
    }));

    sessionStorage.setItem('checkoutCart', JSON.stringify(checkoutCart));
    
    window.location.href = `carrinho.html`;
}


function handleCategoryClick(category) {
    if (category === 'Todos') {
        switchView('home');
    } else if (category === 'Avaliações') {
        switchView('reviews');
    } else {
        switchView('category', category);
    }
}

function goToProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        document.getElementById('search-bar').value = '';
        renderSearchResults([]);
        switchView('category', product.category, productId);
    }
}

function handleSearchInput() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    if (!searchTerm) {
        renderSearchResults([]);
        return;
    }
    const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
    renderSearchResults(filteredProducts.slice(0, 5));
}

// --- FUNÇÕES DE API E INICIALIZAÇÃO ---

async function fetchData() {
    const productsPromise = fetch('products.json?v=4').then(res => res.json());
    const categoriesPromise = fetch('categories.json?v=2').then(res => res.json());

    try {
        const [products, categories] = await Promise.all([productsPromise, categoriesPromise]);
        
        allProducts = products;
        allCategories = categories;

        // LÓGICA DE ORDENAÇÃO (MOVIDA PARA O JS PARA GARANTIR A ORDEM NA EXIBIÇÃO)
        const offerCategoryName = 'Ofertas';
        const offerOrder = [500,501,504,499,498,502,503,85, 91, 18, 106, 122, 86, 92, 19, 107, 123, 177, 160, 66, 78, 207, 44, 49, 264];
        const orderMap = new Map(offerOrder.map((id, index) => [id, index]));
        
        const offerProducts = allProducts.filter(p => p.category === offerCategoryName);
        const otherProducts = allProducts.filter(p => p.category !== offerCategoryName);
        
        offerProducts.sort((a, b) => {
            const indexA = orderMap.get(a.id);
            const indexB = orderMap.get(b.id);
            if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
            if (indexA !== undefined) return -1;
            if (indexB !== undefined) return 1;
            return 0;
        });
        
        allProducts = [...offerProducts, ...otherProducts];

        loadCart();
        renderCategoryNav();
        renderCategoryGrid();
        renderAllCarousels();
    } catch (error) {
        console.error("Falha ao buscar dados da API:", error);
        document.getElementById('carousels-container').innerHTML = `<p class="text-center text-red-500 col-span-full">Não foi possível carregar os produtos.</p>`;
    }
}

// --- TRACKING DE USUÁRIOS ---

function getCookie(name) {
    return document.cookie.split('; ').reduce((acc, cookie) => {
        let [key, val] = cookie.split('=');
        return key === name ? val : acc;
    }, "");
}

async function coletarTrackingData() {
    // RECUPERAR dados existentes do localStorage (PRESERVAR!)
    let trackingData = JSON.parse(localStorage.getItem('tracking_data')) || {};
    
    // Atualizar dados que sempre mudam
    trackingData.user_agent = navigator.userAgent;
    trackingData.language = navigator.language;
    trackingData.screen_width = window.screen.width;
    trackingData.screen_height = window.screen.height;
    trackingData.viewport_width = window.innerWidth;
    trackingData.viewport_height = window.innerHeight;
    trackingData.url = window.location.href;
    trackingData.url_path = window.location.pathname;
    trackingData.url_query = window.location.search;
    trackingData.timestamp = new Date().toISOString();
    
    // Adicionar timezone se não existir
    if (!trackingData.timezone) {
        trackingData.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // Coletar parâmetros UTM da URL ATUAL (só sobrescrever se existir na URL)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('utm_source')) trackingData.utm_source = urlParams.get('utm_source');
    if (urlParams.get('utm_medium')) trackingData.utm_medium = urlParams.get('utm_medium');
    if (urlParams.get('utm_campaign')) trackingData.utm_campaign = urlParams.get('utm_campaign');
    if (urlParams.get('utm_term')) trackingData.utm_term = urlParams.get('utm_term');
    if (urlParams.get('utm_content')) trackingData.utm_content = urlParams.get('utm_content');
    
    // Coletar IDs de clique da URL (só sobrescrever se existir na URL)
    if (urlParams.get('gclid')) trackingData.gclid = urlParams.get('gclid');
    if (urlParams.get('fbclid')) trackingData.fbclid = urlParams.get('fbclid');
    if (urlParams.get('ttclid')) trackingData.ttclid = urlParams.get('ttclid');
    if (urlParams.get('msclkid')) trackingData.msclkid = urlParams.get('msclkid');
    if (urlParams.get('gbraid')) trackingData.gbraid = urlParams.get('gbraid');
    if (urlParams.get('wbraid')) trackingData.wbraid = urlParams.get('wbraid');
    
    // Coletar parâmetros adicionais de tracking
    if (urlParams.get('src')) trackingData.src = urlParams.get('src');
    if (urlParams.get('sck')) trackingData.sck = urlParams.get('sck');
    if (urlParams.get('xcod')) trackingData.xcod = urlParams.get('xcod');

    // Coletar cookies do Facebook (só se ainda não existirem)
    if (!trackingData.fbp || !trackingData.fbc) {
        // Aguardar um pouco para garantir que o Pixel gerou os cookies
        await new Promise(resolve => setTimeout(resolve, 500));
        const fbp = getCookie('_fbp');
        const fbc = getCookie('_fbc');
        if (fbp) trackingData.fbp = fbp;
        if (fbc) trackingData.fbc = fbc;
        
        // Se fbp não existir, tentar novamente após mais tempo
        if (!trackingData.fbp) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const fbp2 = getCookie('_fbp');
            const fbc2 = getCookie('_fbc');
            if (fbp2) trackingData.fbp = fbp2;
            if (fbc2) trackingData.fbc = fbc2;
        }
    }

    // Coletar dados do servidor via PHP (só se ainda não existirem)
    if (!trackingData.ip || !trackingData.referer) {
        try {
            const serverResponse = await fetch('get_tracking_data.php');
            const serverData = await serverResponse.json();
            if (serverData.ip) trackingData.ip = serverData.ip;
            if (serverData.referer) trackingData.referer = serverData.referer;
            if (serverData.accept_language) trackingData.accept_language = serverData.accept_language;
        } catch (error) {
            console.log('Erro ao obter dados do servidor:', error);
        }
    }

    // Gerar ou recuperar session_id
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    trackingData.session_id = sessionId;

    // Verificar se é primeira visita
    const firstVisit = localStorage.getItem('first_visit');
    if (!firstVisit) {
        const now = new Date().toISOString();
        localStorage.setItem('first_visit', now);
        trackingData.first_visit = now;
    } else {
        trackingData.first_visit = firstVisit;
    }

    // Salvar todos os dados no localStorage
    localStorage.setItem('tracking_data', JSON.stringify(trackingData));
    
    // Salvar também dados individuais para fácil acesso
    if (trackingData.utm_source) localStorage.setItem('utm_source', trackingData.utm_source);
    if (trackingData.utm_medium) localStorage.setItem('utm_medium', trackingData.utm_medium);
    if (trackingData.utm_campaign) localStorage.setItem('utm_campaign', trackingData.utm_campaign);
    if (trackingData.utm_term) localStorage.setItem('utm_term', trackingData.utm_term);
    if (trackingData.utm_content) localStorage.setItem('utm_content', trackingData.utm_content);
}

// Garante que UTMs/IDs de clique da URL inicial sejam persistidos
// antes do usuario navegar para carrinho/pagamento (que nao mantem querystring).
document.addEventListener('DOMContentLoaded', function () {
    try {
        // Nao bloquear a renderizacao; apenas dispara a coleta.
        const p = coletarTrackingData();
        if (p && typeof p.catch === 'function') {
            p.catch((e) => console.log('Erro ao coletar tracking:', e));
        }
    } catch (e) {
        console.log('Erro ao iniciar coleta de tracking:', e);
    }
});

// --- MODAL DE IMAGEM AMPLIADA ---
function showImageModal(imageSrc, imageAlt = '') {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    if (modal && modalImage) {
        modalImage.src = imageSrc;
        modalImage.alt = imageAlt || 'Imagem ampliada';
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Previne scroll do body
    } else {
        console.error('Modal não encontrado:', { modal, modalImage });
    }
}

// Torna a função globalmente acessível
window.showImageModal = showImageModal;
window.closeImageModal = closeImageModal;

function closeImageModal(event) {
    // Se o evento foi passado e o clique foi no conteúdo do modal (não no backdrop), não fecha
    if (event && event.target.id !== 'image-modal' && event.target.closest('#image-modal > div')) {
        return;
    }
    
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restaura scroll do body
    }
}

// Fechar modal com ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
});

// Event delegation para imagens de produtos (funciona mesmo com conteúdo dinâmico)
// O zoom funciona apenas na categoria "Ofertas"
document.addEventListener('click', function(e) {
    // Verifica se o clique foi em um figure com a classe product-image-figure
    const figure = e.target.closest('figure.product-image-figure');
    if (figure) {
        // Verifica se a categoria ativa é "Ofertas"
        if (activeCategory === 'Ofertas') {
            e.preventDefault();
            e.stopPropagation();
            const imageSrc = figure.getAttribute('data-image-src') || figure.querySelector('img')?.src;
            const imageAlt = figure.getAttribute('data-image-alt') || figure.querySelector('img')?.alt || 'Imagem ampliada';
            if (imageSrc) {
                showImageModal(imageSrc, imageAlt);
            }
        }
    }
});

// --- EVENT LISTENERS E INICIALIZAÇÃO ---
window.addEventListener('load', async function () {
    // 1. Busca os dados dos produtos e categorias
    await fetchData();
    
    // 2. Inicializa o sistema de localização
    // O splash screen no HTML cuida do fluxo completo de seleção.
    // Aqui apenas atualizamos os textos caso o cookie já exista.
    initLocationSystem();

    // 4. Configura os event listeners básicos (carrinho, busca, etc.)
    const searchBar = document.getElementById('search-bar');
    const searchContainer = document.getElementById('search-container');
    if (searchBar) searchBar.addEventListener('input', handleSearchInput);
    document.addEventListener('click', (e) => {
        if (searchContainer && !searchContainer.contains(e.target)) {
            document.getElementById('search-results').classList.add('hidden');
        }
    });
    
    document.getElementById('cart-collapse-btn').addEventListener('click', collapseCart);
    document.getElementById('cart-collapsed').addEventListener('click', expandCart);
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        if (cart.length > 0) {
            scrollTimeout = setTimeout(collapseCart, 500);
        }
    });

    // 5. Atualiza ano no footer (se existir)
    const footerYear = document.getElementById('currentYearFooter');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    // 6. CÓDIGO CORRIGIDO E SEGURO PARA A BARRA DE PESQUISA FIXA
    try {
        const nav = document.getElementById('main-category-nav');
        const searchContainer = document.getElementById('search-container');
        const mainContent = document.querySelector('main');

        if (nav && searchContainer && mainContent) {
            const navHeight = nav.offsetHeight;
            const searchContainerOffsetTop = searchContainer.offsetTop;
            
            // Define a variável CSS com a altura da navegação para o CSS usar
            document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
            
            // Adiciona a regra de padding dinamicamente para evitar o "pulo"
            const searchHeight = searchContainer.offsetHeight;
            const styleEl = document.createElement('style');
            styleEl.innerHTML = `main.search-is-fixed { padding-top: ${searchHeight}px !important; }`;
            document.head.appendChild(styleEl);

            window.addEventListener('scroll', () => {
                // A condição é mais simples: a rolagem passou da posição original da busca menos a altura da nav?
                if (window.scrollY >= (searchContainerOffsetTop - navHeight)) {
                    searchContainer.classList.add('fixed-search');
                    mainContent.classList.add('search-is-fixed');
                } else {
                    searchContainer.classList.remove('fixed-search');
                    mainContent.classList.remove('search-is-fixed');
                }
            });
        }
    } catch (error) {
        console.error("Erro ao inicializar a barra de pesquisa fixa:", error);
    }

});

// --- FUNÇÕES DE GEOLOCALIZAÇÃO ---
function setCookie(name, value, days) {
    let expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

function getCookie(name) {
    return document.cookie.split("; ").reduce((acc, cookie) => {
        let [key, val] = cookie.split("=");
        return key === name ? val : acc;
    }, "");
}

function checkCookie(nome) {
    return getCookie(nome) !== "";
}

async function fetchLocation() {
    try {
        let response = await fetch("https://get.geojs.io/v1/ip/geo.json");
        let { city = "Local Desconhecido", region = "Local Desconhecido" } = await response.json();
        return { city, region };
    } catch (error) {
        console.error("Erro ao obter a localização:", error);
        return { city: "Local Desconhecido", region: "Local Desconhecido" };
    }
}

const estados = {
    "Acre": "AC",
    "Alagoas": "AL",
    "Amapá": "AP",
    "Amazonas": "AM",
    "Bahia": "BA",
    "Ceará": "CE",
    "Distrito Federal": "DF",
    "Espírito Santo": "ES",
    "Goiás": "GO",
    "Maranhão": "MA",
    "Mato Grosso": "MT",
    "Mato Grosso do Sul": "MS",
    "Minas Gerais": "MG",
    "Pará": "PA",
    "Paraíba": "PB",
    "Paraná": "PR",
    "Pernambuco": "PE",
    "Piauí": "PI",
    "Rio de Janeiro": "RJ",
    "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS",
    "Rondônia": "RO",
    "Roraima": "RR",
    "Santa Catarina": "SC",
    "São Paulo": "SP",
    "Sergipe": "SE",
    "Tocantins": "TO"
};

const estados_input = {
    "AC": "Acre",
    "AL": "Alagoas",
    "AP": "Amapá",
    "AM": "Amazonas",
    "BA": "Bahia",
    "CE": "Ceará",
    "DF": "Distrito Federal",
    "ES": "Espírito Santo",
    "GO": "Goiás",
    "MA": "Maranhão",
    "MT": "Mato Grosso",
    "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais",
    "PA": "Pará",
    "PB": "Paraíba",
    "PR": "Paraná",
    "PE": "Pernambuco",
    "PI": "Piauí",
    "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul",
    "RO": "Rondônia",
    "RR": "Roraima",
    "SC": "Santa Catarina",
    "SP": "São Paulo",
    "SE": "Sergipe",
    "TO": "Tocantins"
};

// Lista simplificada de cidades principais do Brasil
const cidades_por_estados = [
    ["SP", "São Paulo"],
    ["SP", "Campinas"],
    ["SP", "Santos"],
    ["SP", "São José dos Campos"],
    ["SP", "Ribeirão Preto"],
    ["SP", "Sorocaba"],
    ["RJ", "Rio de Janeiro"],
    ["RJ", "Niterói"],
    ["RJ", "Duque de Caxias"],
    ["RJ", "Nova Iguaçu"],
    ["MG", "Belo Horizonte"],
    ["MG", "Uberlândia"],
    ["MG", "Contagem"],
    ["MG", "Juiz de Fora"],
    ["ES", "Vitória"],
    ["ES", "Vila Velha"],
    ["ES", "Serra"],
    ["PR", "Curitiba"],
    ["PR", "Londrina"],
    ["PR", "Maringá"],
    ["SC", "Florianópolis"],
    ["SC", "Joinville"],
    ["SC", "Blumenau"],
    ["RS", "Porto Alegre"],
    ["RS", "Caxias do Sul"],
    ["RS", "Pelotas"],
    ["BA", "Salvador"],
    ["BA", "Feira de Santana"],
    ["BA", "Vitória da Conquista"],
    ["PE", "Recife"],
    ["PE", "Olinda"],
    ["PE", "Jaboatão dos Guararapes"],
    ["CE", "Fortaleza"],
    ["CE", "Caucaia"],
    ["PA", "Belém"],
    ["PA", "Ananindeua"],
    ["AM", "Manaus"],
    ["GO", "Goiânia"],
    ["GO", "Aparecida de Goiânia"],
    ["DF", "Brasília"],
    ["MA", "São Luís"],
    ["PI", "Teresina"],
    ["RN", "Natal"],
    ["PB", "João Pessoa"],
    ["AL", "Maceió"],
    ["SE", "Aracaju"],
    ["TO", "Palmas"],
    ["MT", "Cuiabá"],
    ["MS", "Campo Grande"],
    ["AC", "Rio Branco"],
    ["RO", "Porto Velho"],
    ["RR", "Boa Vista"],
    ["AP", "Macapá"]
];

async function atualizarLocalizacao() {
    let cidade = getCookie("localCidade");
    let estado = getCookie("localEstado");

    if (!cidade || !estado) {
        ({ city: cidade, region: estado } = await fetchLocation());
    }

    document.querySelectorAll("#localCidade").forEach((el) => (el.textContent = cidade));
    document.querySelectorAll("#localEstado").forEach((el) => (el.textContent = estado));
}

// --- SISTEMA DE LOCALIZAÇÃO ---
// O fluxo de seleção (estado/cidade) é feito pelo splash screen no HTML.
// Esta função apenas atualiza os textos da página com o cookie salvo.
function initLocationSystem() {
    atualizarLocalizacao();
}

// --- OCULTAR STATUS "ABERTO" AO ROLAR A PÁGINA ---
let lastScrollTop = 0;
const statusAberto = document.querySelector('.aberto');

window.addEventListener('scroll', function() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 50) {
        // Rolou para baixo mais de 50px - ocultar
        if (statusAberto) {
            statusAberto.style.opacity = '0';
            statusAberto.style.pointerEvents = 'none';
        }
    } else {
        // Está no topo - mostrar
        if (statusAberto) {
            statusAberto.style.opacity = '1';
            statusAberto.style.pointerEvents = 'auto';
        }
    }
    
    lastScrollTop = scrollTop;
});