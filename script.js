// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBuqC1mLmLgEUxYcXgkcr6o0p0qFAG3eRY",
    authDomain: "marfouz-6b775.firebaseapp.com",
    databaseURL: "https://marfouz-6b775-default-rtdb.firebaseio.com",
    projectId: "marfouz-6b775",
    storageBucket: "marfouz-6b775.firebasestorage.app",
    messagingSenderId: "877095609290",
    appId: "1:877095609290:web:2e6bc0456f1580e1942533",
    measurementId: "G-JSLD71X9Z0"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Structure des données
let donnees = {
    approvisionnements: [],
    ventes: [],
    inventaire: {},
    produits: {}
};

// Variables globales
let synchronisationComplete = false;
let produitEnEdition = null;
let donneesOriginales = null;

// Initialisation de l'application
window.onload = async function() {
    try {
        await initialiserApplication();
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        alert('Erreur lors du chargement de l\'application');
    }
};

async function initialiserApplication() {
    document.getElementById('operationDate').valueAsDate = new Date();
    await synchroniserDonnees();
    configurerEcouteursTempsReel();
    document.getElementById('loading').style.display = 'none';
    synchronisationComplete = true;
}

// Fonctions de synchronisation Firebase
async function synchroniserDonnees() {
    try {
        const snapshot = await database.ref('donnees').once('value');
        const data = snapshot.val();
        if (data) {
            donnees = {
                approvisionnements: data.approvisionnements || [],
                ventes: data.ventes || [],
                inventaire: data.inventaire || {},
                produits: data.produits || {}
            };
            donneesOriginales = {...donnees};
        }
        rafraichirTout();
    } catch (error) {
        console.error('Erreur de synchronisation:', error);
        throw new Error('Erreur lors de la synchronisation des données');
    }
}

function configurerEcouteursTempsReel() {
    database.ref('donnees').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        donnees = {
            approvisionnements: data.approvisionnements || [],
            ventes: data.ventes || [],
            inventaire: data.inventaire || {},
            produits: data.produits || {}
        };
        donneesOriginales = {...donnees};

        if (synchronisationComplete) {
            rafraichirTout();
        }
    });
}

async function sauvegarderDonnees() {
    try {
        await database.ref('donnees').set(donnees);
    } catch (error) {
        console.error('Erreur de sauvegarde:', error);
        throw new Error('Erreur lors de la sauvegarde des données');
    }
}

// Gestion des approvisionnements
async function enregistrerApprovisionnement(event) {
    event.preventDefault();
    if (!synchronisationComplete) {
        alert('Synchronisation en cours, veuillez patienter...');
        return;
    }

    try {
        const formData = {
            date: document.getElementById('operationDate').value,
            produit: document.getElementById('approvProduit').value,
            quantite: parseFloat(document.getElementById('approvQuantite').value),
            prixAchat: parseFloat(document.getElementById('approvPrixAchat').value),
            transport: parseFloat(document.getElementById('approvTransport').value),
            prixVente: parseFloat(document.getElementById('approvPrixVente').value)
        };

        if (!formData.produit) {
            alert('Veuillez sélectionner un produit');
            return;
        }

        const approvisionnement = {
            ...formData,
            prixAchatTotal: formData.prixAchat + formData.transport,
            benefice: (formData.prixVente - (formData.prixAchat + formData.transport)) * formData.quantite
        };

        donnees.approvisionnements.push(approvisionnement);
        await mettreAJourInventaire();
        await sauvegarderDonnees();
        event.target.reset();
        document.getElementById('operationDate').valueAsDate = new Date();
        remplirFormulaireApprovisionnement(approvisionnement.produit);

    } catch (error) {
        console.error('Erreur d\'approvisionnement:', error);
        alert('Erreur lors de l\'enregistrement de l\'approvisionnement');
    }
}

// Gestion des ventes
async function enregistrerVente(event) {
    event.preventDefault();
    if (!synchronisationComplete) {
        alert('Synchronisation en cours, veuillez patienter...');
        return;
    }

    try {
        const formData = {
            date: document.getElementById('operationDate').value,
            produit: document.getElementById('venteProduit').value,
            quantite: parseFloat(document.getElementById('venteQuantite').value),
            prixVente: parseFloat(document.getElementById('ventePrix').value)
        };

        if (!formData.produit) {
            alert('Veuillez sélectionner un produit');
            return;
        }

        // Vérification du stock
        const stockDisponible = donnees.inventaire[formData.produit]?.quantite || 0;
        if (stockDisponible < formData.quantite) {
            alert(`Stock insuffisant. Stock disponible: ${stockDisponible}`);
            return;
        }

        const vente = {
            ...formData,
            total: formData.quantite * formData.prixVente
        };

        donnees.ventes.push(vente);
        await mettreAJourInventaire();
        await sauvegarderDonnees();
        event.target.reset();
        document.getElementById('operationDate').valueAsDate = new Date();

    } catch (error) {
        console.error('Erreur de vente:', error);
        alert('Erreur lors de l\'enregistrement de la vente');
    }
}

// Gestion de l'inventaire
async function mettreAJourInventaire() {
    donnees.inventaire = {};

    // Calcul des entrées (approvisionnements)
    donnees.approvisionnements.forEach(approv => {
        if (!donnees.inventaire[approv.produit]) {
            donnees.inventaire[approv.produit] = { quantite: 0, valeur: 0 };
        }
        donnees.inventaire[approv.produit].quantite += approv.quantite;
        donnees.inventaire[approv.produit].valeur += approv.prixAchatTotal * approv.quantite;
    });

    // Calcul des sorties (ventes)
    donnees.ventes.forEach(vente => {
        if (donnees.inventaire[vente.produit]) {
            donnees.inventaire[vente.produit].quantite -= vente.quantite;
            if (donnees.inventaire[vente.produit].quantite > 0) {
                // Ajustement proportionnel de la valeur
                donnees.inventaire[vente.produit].valeur = 
                    (donnees.inventaire[vente.produit].valeur * 
                    donnees.inventaire[vente.produit].quantite) / 
                    (donnees.inventaire[vente.produit].quantite + vente.quantite);
            } else {
                donnees.inventaire[vente.produit].valeur = 0;
            }
        }
    });
}

// Gestion des produits
function remplirFormulaireApprovisionnement(produit) {
    if (donnees.produits[produit]) {
        const produitInfo = donnees.produits[produit];
        document.getElementById('approvPrixAchat').value = produitInfo.prixAchatDefaut || '';
        document.getElementById('approvPrixVente').value = produitInfo.prixVenteDefaut || '';
        document.getElementById('approvTransport').value = '';
        document.getElementById('approvQuantite').value = '';
    }
}

async function ajouterProduit(event) {
    event.preventDefault();
    if (!synchronisationComplete) {
        alert('Synchronisation en cours, veuillez patienter...');
        return;
    }

    try {
        const nomProduit = document.getElementById('nouveauProduit').value.trim();
        if (!nomProduit) {
            alert('Le nom du produit est requis');
            return;
        }

        if (donnees.produits[nomProduit]) {
            alert('Ce produit existe déjà');
            return;
        }

        donnees.produits[nomProduit] = {
            prixAchatDefaut: parseFloat(document.getElementById('prixAchatDefaut').value) || null,
            prixVenteDefaut: parseFloat(document.getElementById('prixVenteDefaut').value) || null
        };

        await sauvegarderDonnees();
        event.target.reset();
        rafraichirTableauProduits();
        mettreAJourSelectionProduits();

    } catch (error) {
        console.error('Erreur d\'ajout de produit:', error);
        alert('Erreur lors de l\'ajout du produit');
    }
}

async function modifierProduit(nomProduit) {
    try {
        const nouveauNom = document.getElementById(`edit-nom-${nomProduit}`).value.trim();
        const prixAchat = parseFloat(document.getElementById(`edit-achat-${nomProduit}`).value) || null;
        const prixVente = parseFloat(document.getElementById(`edit-vente-${nomProduit}`).value) || null;

        if (!nouveauNom) {
            alert('Le nom du produit est requis');
            return;
        }

        if (nouveauNom !== nomProduit && donnees.produits[nouveauNom]) {
            alert('Ce nom de produit existe déjà');
            return;
        }

        // Mise à jour des références si le nom change
        if (nouveauNom !== nomProduit) {
            // Mise à jour des approvisionnements
            donnees.approvisionnements = donnees.approvisionnements.map(a => ({
                ...a,
                produit: a.produit === nomProduit ? nouveauNom : a.produit
            }));

            // Mise à jour des ventes
            donnees.ventes = donnees.ventes.map(v => ({
                ...v,
                produit: v.produit === nomProduit ? nouveauNom : v.produit
            }));

            // Mise à jour de l'inventaire
            if (donnees.inventaire[nomProduit]) {
                donnees.inventaire[nouveauNom] = donnees.inventaire[nomProduit];
                delete donnees.inventaire[nomProduit];
            }

            // Suppression de l'ancien produit
            delete donnees.produits[nomProduit];
        }

        // Mise à jour ou création du produit
        donnees.produits[nouveauNom] = {
            prixAchatDefaut: prixAchat,
            prixVenteDefaut: prixVente
        };

        await sauvegarderDonnees();
        produitEnEdition = null;
        rafraichirTout();

    } catch (error) {
        console.error('Erreur de modification:', error);
        alert('Erreur lors de la modification du produit');
    }
}

async function supprimerProduit(nomProduit) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le produit "${nomProduit}" ?`)) {
        return;
    }

    try {
        const aDesMovements = 
            donnees.approvisionnements.some(a => a.produit === nomProduit) ||
            donnees.ventes.some(v => v.produit === nomProduit);

        if (aDesMovements) {
            alert('Impossible de supprimer ce produit car il a des mouvements associés');
            return;
        }

        delete donnees.produits[nomProduit];
        delete donnees.inventaire[nomProduit];
        
        await sauvegarderDonnees();
        rafraichirTout();

    } catch (error) {
        console.error('Erreur de suppression:', error);
        alert('Erreur lors de la suppression du produit');
    }
}

// Fonctions de rafraîchissement
function rafraichirTout() {
    rafraichirTableauApprovisionnements();
    rafraichirTableauVentes();
    rafraichirTableauInventaire();
    rafraichirTableauProduits();
    mettreAJourSelectionProduits();
}

function rafraichirTableauApprovisionnements() {
    const tbody = document.querySelector('#approvTable tbody');
    tbody.innerHTML = '';
    
    let totaux = {
        quantite: 0,
        prixAchat: 0,
        transport: 0,
        prixAchatTotal: 0,
        prixVente: 0,
        benefice: 0
    };

    donnees.approvisionnements.forEach(approv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(approv.date)}</td>
            <td>${approv.produit}</td>
            <td class="text-right">${formatNumber(approv.quantite)}</td>
            <td class="text-right">${formatCurrency(approv.prixAchat)}</td>
            <td class="text-right">${formatCurrency(approv.transport)}</td>
            <td class="text-right">${formatCurrency(approv.prixAchatTotal)}</td>
            <td class="text-right">${formatCurrency(approv.prixVente)}</td>
            <td class="text-right">${formatCurrency(approv.benefice)}</td>
        `;
        tbody.appendChild(tr);

        totaux.quantite += approv.quantite;
        totaux.prixAchat += approv.prixAchat * approv.quantite;
        totaux.transport += approv.transport * approv.quantite;
        totaux.prixAchatTotal += approv.prixAchatTotal * approv.quantite;
        totaux.prixVente += approv.prixVente * approv.quantite;
        totaux.benefice += approv.benefice;
    });

// Mise à jour des totaux
document.getElementById('totalApprovQuantite').textContent = formatNumber(totaux.quantite);
document.getElementById('totalApprovPrixAchat').textContent = formatCurrency(totaux.prixAchat);
document.getElementById('totalApprovTransport').textContent = formatCurrency(totaux.transport);
document.getElementById('totalApprovPrixAchatTotal').textContent = formatCurrency(totaux.prixAchatTotal);
document.getElementById('totalApprovPrixVente').textContent = formatCurrency(totaux.prixVente);
document.getElementById('totalApprovBenefice').textContent = formatCurrency(totaux.benefice);
}

function rafraichirTableauVentes() {
const tbody = document.querySelector('#venteTable tbody');
tbody.innerHTML = '';

let totaux = {
    quantite: 0,
    prixVente: 0,
    total: 0
};

donnees.ventes.forEach(vente => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${formatDate(vente.date)}</td>
        <td>${vente.produit}</td>
        <td class="text-right">${formatNumber(vente.quantite)}</td>
        <td class="text-right">${formatCurrency(vente.prixVente)}</td>
        <td class="text-right">${formatCurrency(vente.total)}</td>
    `;
    tbody.appendChild(tr);

    totaux.quantite += vente.quantite;
    totaux.prixVente += vente.prixVente;
    totaux.total += vente.total;
});

const moyennePrixVente = donnees.ventes.length ? totaux.prixVente / donnees.ventes.length : 0;

document.getElementById('totalVenteQuantite').textContent = formatNumber(totaux.quantite);
document.getElementById('moyenneVentePrix').textContent = formatCurrency(moyennePrixVente);
document.getElementById('totalVenteTotal').textContent = formatCurrency(totaux.total);
}

function rafraichirTableauInventaire() {
const tbody = document.querySelector('#inventaireTable tbody');
tbody.innerHTML = '';

let totaux = {
    stock: 0,
    valeur: 0
};

Object.entries(donnees.inventaire)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([produit, info]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${produit}</td>
            <td class="text-right">${formatNumber(info.quantite)}</td>
            <td class="text-right">${formatCurrency(info.valeur)}</td>
        `;
        tbody.appendChild(tr);

        totaux.stock += info.quantite;
        totaux.valeur += info.valeur;
    });

document.getElementById('totalInventaireStock').textContent = formatNumber(totaux.stock);
document.getElementById('totalInventaireValeur').textContent = formatCurrency(totaux.valeur);
}

function rafraichirTableauProduits() {
const tbody = document.querySelector('#produitsTable tbody');
tbody.innerHTML = '';

Object.entries(donnees.produits)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([nomProduit, produit]) => {
        const stockInfo = donnees.inventaire[nomProduit] || { quantite: 0, valeur: 0 };
        const tr = document.createElement('tr');
        
        if (produitEnEdition === nomProduit) {
            tr.innerHTML = `
                <td><input type="text" id="edit-nom-${nomProduit}" value="${nomProduit}" class="form-control" /></td>
                <td><input type="number" id="edit-achat-${nomProduit}" value="${produit.prixAchatDefaut || ''}" step="0.01" min="0" class="form-control" /></td>
                <td><input type="number" id="edit-vente-${nomProduit}" value="${produit.prixVenteDefaut || ''}" step="0.01" min="0" class="form-control" /></td>
                <td class="text-right">${formatNumber(stockInfo.quantite)}</td>
                <td class="text-right">${formatCurrency(stockInfo.valeur)}</td>
                <td class="product-actions">
                    <button onclick="modifierProduit('${nomProduit}')" class="btn-info">Sauvegarder</button>
                    <button onclick="annulerEdition()" class="btn-warning">Annuler</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td>${nomProduit}</td>
                <td class="text-right">${produit.prixAchatDefaut ? formatCurrency(produit.prixAchatDefaut) : '-'}</td>
                <td class="text-right">${produit.prixVenteDefaut ? formatCurrency(produit.prixVenteDefaut) : '-'}</td>
                <td class="text-right">${formatNumber(stockInfo.quantite)}</td>
                <td class="text-right">${formatCurrency(stockInfo.valeur)}</td>
                <td class="product-actions">
                    <button onclick="editerProduit('${nomProduit}')" class="btn-warning">Éditer</button>
                    <button onclick="supprimerProduit('${nomProduit}')" class="btn-danger">Supprimer</button>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });
}

function mettreAJourSelectionProduits() {
const selecteurs = ['approvProduit', 'venteProduit'];

selecteurs.forEach(id => {
    const select = document.getElementById(id);
    const valeurActuelle = select.value;
    select.innerHTML = '';
    
    // Option par défaut
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Sélectionner un produit --';
    select.appendChild(defaultOption);
    
    // Ajout des produits triés
    Object.keys(donnees.produits)
        .sort()
        .forEach(produit => {
            const option = document.createElement('option');
            option.value = produit;
            option.textContent = produit;
            select.appendChild(option);
        });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (valeurActuelle && donnees.produits[valeurActuelle]) {
        select.value = valeurActuelle;
    }
});
}

// Fonctions de filtrage
function filtrerDonnees() {
const dateDebut = document.getElementById('dateDebut').value;
const dateFin = document.getElementById('dateFin').value;

if (!dateDebut || !dateFin) {
    alert('Veuillez sélectionner une période de filtrage');
    return;
}

const donneesFiltrees = {
    ...donnees,
    approvisionnements: donnees.approvisionnements.filter(a => 
        a.date >= dateDebut && a.date <= dateFin
    ),
    ventes: donnees.ventes.filter(v => 
        v.date >= dateDebut && v.date <= dateFin
    )
};

donnees = donneesFiltrees;
rafraichirTableauApprovisionnements();
rafraichirTableauVentes();
donnees = donneesOriginales;
}

function reinitialiserFiltres() {
document.getElementById('dateDebut').value = '';
document.getElementById('dateFin').value = '';
rafraichirTout();
}

// Fonctions d'export et d'impression
function exporterTableau(tableId, format) {
const table = document.getElementById(tableId);
const titre = table.closest('section').querySelector('h2 span').textContent;
const date = new Date().toLocaleDateString();
const periode = getPeriodeFilter();

if (format === 'pdf') {
    exporterPDF(table, titre, date, periode);
} else if (format === 'excel') {
    exporterExcel(table, titre, date, periode);
}
}

function exporterPDF(table, titre, date, periode) {
const { jsPDF } = window.jspdf;
const doc = new jsPDF();

// En-tête
doc.setFontSize(16);
doc.text(titre, 14, 15);
doc.setFontSize(10);
doc.text(`Date d'export: ${date}`, 14, 25);
if (periode) {
    doc.text(`Période: ${periode}`, 14, 30);
}

// Configuration du tableau
doc.autoTable({
    html: table,
    startY: periode ? 35 : 30,
    styles: { 
        fontSize: 8,
        cellPadding: 2
    },
    headStyles: { 
        fillColor: [73, 175, 80],
        textColor: [255, 255, 255]
    },
    footStyles: { 
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
    },
    margin: { top: 30 },
    didParseCell: function(data) {
        // Alignement des nombres à droite
        if (typeof data.cell.raw === 'number' || 
            (typeof data.cell.raw === 'string' && !isNaN(data.cell.raw))) {
            data.cell.styles.halign = 'right';
        }
    }
});

doc.save(`${titre}_${date.replace(/\//g, '-')}.pdf`);
}

function exporterExcel(table, titre, date, periode) {
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.table_to_sheet(table);

// Ajout des métadonnées
XLSX.utils.sheet_add_aoa(ws, [
    [`${titre}`],
    [`Export du ${date}`],
    periode ? [`Période: ${periode}`] : [],
    [''] // Ligne vide avant le tableau
], { origin: 'A1' });

// Formatage des cellules
const range = XLSX.utils.decode_range(ws['!ref']);
for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = {c: C, r: R};
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        const cell = ws[cell_ref];

        if (!cell) continue;

        // Formatage des nombres
        if (typeof cell.v === 'number') {
            if (cell.v % 1 === 0) {
                // Nombre entier
                cell.z = '#,##0';
            } else {
                // Nombre décimal
                cell.z = '#,##0.00';
            }
        }
    }
}

XLSX.utils.book_append_sheet(wb, ws, titre);
XLSX.writeFile(wb, `${titre}_${date.replace(/\//g, '-')}.xlsx`);
}

function imprimerTableau(tableId) {
const printWindow = window.open('', '', 'width=1000,height=700');
const table = document.getElementById(tableId);
const titre = table.closest('section').querySelector('h2 span').textContent;
const date = new Date().toLocaleDateString();
const periode = getPeriodeFilter();

printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>${titre}</title>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
            }
            .print-header { 
                text-align: center; 
                margin-bottom: 20px; 
            }
            .print-header h1 { 
                font-size: 24px; 
                margin-bottom: 10px; 
            }
            .print-header p { 
                font-size: 14px; 
                color: #666; 
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px; 
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 8px; 
                text-align: left; 
            }
            th { 
                background-color: #f5f5f5; 
            }
            .total-row { 
                background-color: #f0f0f0; 
                font-weight: bold; 
            }
            .text-right { 
                text-align: right; 
            }
            @media print {
                .no-print { 
                    display: none; 
                }
            }
        </style>
    </head>
    <body>
        <div class="print-header">
            <h1>${titre}</h1>
            <p>Date d'impression: ${date}</p>
            ${periode ? `<p>Période: ${periode}</p>` : ''}
        </div>
        ${table.outerHTML}
    </body>
    </html>
`);

printWindow.document.close();
printWindow.focus();

// Attendre le chargement complet avant d'imprimer
printWindow.onload = function() {
    printWindow.print();
    setTimeout(() => printWindow.close(), 250);
};
}

// Fonctions utilitaires
function formatDate(dateStr) {
const date = new Date(dateStr);
return date.toLocaleDateString('fr-FR');
}

function formatNumber(number) {
return new Intl.NumberFormat('fr-FR').format(number);
}

function formatCurrency(number) {
    return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: 'XAF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

function getPeriodeFilter() {
const dateDebut = document.getElementById('dateDebut').value;
const dateFin = document.getElementById('dateFin').value;
if (dateDebut && dateFin) {
    return `Du ${formatDate(dateDebut)} au ${formatDate(dateFin)}`;
}
return '';
}

// Fonctions Modal
function editerProduit(nomProduit) {
produitEnEdition = nomProduit;
rafraichirTableauProduits();
}

function annulerEdition() {
produitEnEdition = null;
rafraichirTableauProduits();
}

function ouvrirModalProduit() {
    document.getElementById('produitModal').style.display = 'block';
    rafraichirTableauProduits();
}

function fermerModalProduit() {
    document.getElementById('produitModal').style.display = 'none';
    produitEnEdition = null;
}



// Gestionnaire d'erreurs global
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Erreur globale:', {
        message,
        source,
        lineno,
        colno,
        error
    });
    
    let errorMessage = 'Une erreur est survenue.';
    if (error && error.message) {
        errorMessage += '\nDétail : ' + error.message;
    }
    
    alert(errorMessage + '\nVeuillez rafraîchir la page si le problème persiste.');
    return false;
};

// Gestionnaire d'événements pour fermer le modal quand on clique en dehors
window.onclick = function(event) {
    const modal = document.getElementById('produitModal');
    if (event.target === modal) {
        fermerModalProduit();
    }
};

// Gestionnaire d'événements pour les raccourcis clavier
document.addEventListener('keydown', function(event) {
    // Échap pour fermer le modal
    if (event.key === 'Escape') {
        const modal = document.getElementById('produitModal');
        if (modal.style.display === 'block') {
            fermerModalProduit();
        }
    }
});

// Protection contre la perte de données
window.addEventListener('beforeunload', function(event) {
    if (document.querySelector('form:invalid') || produitEnEdition) {
        event.preventDefault();
        event.returnValue = '';
    }
});

// Initialisation des event listeners pour le formatage automatique des nombres
document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('blur', function() {
        if (this.value) {
            this.value = parseFloat(this.value).toFixed(2);
        }
    });
});