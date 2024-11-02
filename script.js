// Configuration Firebase (si nécessaire)
const firebaseConfig = {
  apiKey: "AIzaSyBuqC1mLmLgEUxYcXgkcr6o0p0qFAG3eRY",
  authDomain: "marfouz-6b775.firebaseapp.com",
  databaseURL: "https://marfouz-6b775-default-rtdb.firebaseio.com",
  projectId: "marfouz-6b775",
  storageBucket: "marfouz-6b775.appspot.com",
  messagingSenderId: "877095609290",
  appId: "1:877095609290:web:2e6bc0456f1580e1942533",
  measurementId: "G-JSLD71X9Z0"
};

// Initialiser Firebase (si nécessaire)
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Structure des données
let donnees = {
    approvisionnements: [],
    ventes: [],
    inventaire: {},
    produits: {} 
};

// Mode en ligne/hors ligne
let modeEnLigne = false; 

// Chargement initial des données
window.onload = function () {
    chargerDonnees();
    mettreAJourSelectionProduits();
    document.getElementById('operationDate').valueAsDate = new Date();

    // Définir le mode hors ligne par défaut
    modeEnLigne = false; 
    document.getElementById('mode-offline').checked = true;
};

// Fonctions de stockage
function sauvegarderDonnees() {
    localStorage.setItem('donnees', JSON.stringify(donnees));
}

function chargerDonnees() {
    const donneesStockees = localStorage.getItem('donnees');
    if (donneesStockees) {
        donnees = JSON.parse(donneesStockees);
        rafraichirTableaux();
    } 
}

// Gestion des approvisionnements
function enregistrerApprovisionnement(event) {
    event.preventDefault();

    const date = document.getElementById('operationDate').value;
    const produit = document.getElementById('approvProduit').value;
    const quantite = parseFloat(document.getElementById('approvQuantite').value);
    const prixAchat = parseFloat(document.getElementById('approvPrixAchat').value);
    const transport = parseFloat(document.getElementById('approvTransport').value);
    const prixVente = parseFloat(document.getElementById('approvPrixVente').value);

    const prixAchatTotal = prixAchat + transport;
    const benefice = (prixVente - prixAchatTotal) * quantite;

    const approvisionnement = {
        date,
        produit,
        quantite,
        prixAchat,
        transport,
        prixAchatTotal,
        prixVente,
        benefice
    };

    donnees.approvisionnements.push(approvisionnement);
    mettreAJourInventaire();
    sauvegarderDonnees();
    rafraichirTableaux();
    event.target.reset();

    if (modeEnLigne) {
        database.ref('approvisionnements').push(approvisionnement);
    }
}

// Gestion des ventes
function enregistrerVente(event) {
    event.preventDefault();

    const date = document.getElementById('operationDate').value;
    const produit = document.getElementById('venteProduit').value;
    const quantite = parseFloat(document.getElementById('venteQuantite').value);
    const prixVente = parseFloat(document.getElementById('ventePrix').value);
    const total = quantite * prixVente;

    const vente = {
        date,
        produit,
        quantite,
        prixVente,
        total
    };

    donnees.ventes.push(vente);
    mettreAJourInventaire();
    sauvegarderDonnees();
    rafraichirTableaux();
    event.target.reset();

    if (modeEnLigne) {
        database.ref('ventes').push(vente);
    }
}

// Gestion de l'inventaire
function mettreAJourInventaire() {
    // Reset de l'inventaire
    donnees.inventaire = {};

    // Calculer l'inventaire à partir des approvisionnements
    donnees.approvisionnements.forEach(approv => {
        if (!donnees.inventaire[approv.produit]) {
            donnees.inventaire[approv.produit] = {
                quantite: 0,
                valeur: 0
            };
        }
        donnees.inventaire[approv.produit].quantite += approv.quantite;
        donnees.inventaire[approv.produit].valeur += approv.prixAchatTotal * approv.quantite;
    });

    // Soustraire les ventes de l'inventaire
    donnees.ventes.forEach(vente => {
        if (donnees.inventaire[vente.produit]) {
            donnees.inventaire[vente.produit].quantite -= vente.quantite;
            donnees.inventaire[vente.produit].valeur -= vente.prixVente * vente.quantite;
        }
    });
}

// Mise à jour des tableaux
function rafraichirTableaux() {
    rafraichirTableauApprovisionnements();
    rafraichirTableauVentes();
    rafraichirTableauInventaire();
    mettreAJourSelectionProduits();
}

function rafraichirTableauApprovisionnements() {
    const tbody = document.querySelector('#approvTable tbody');
    tbody.innerHTML = '';

    donnees.approvisionnements.forEach((approv, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${approv.date}</td>
            <td>${approv.produit}</td>
            <td>${approv.quantite}</td>
            <td>${approv.prixAchat}</td>
            <td>${approv.transport}</td>
            <td>${approv.prixAchatTotal}</td>
            <td>${approv.prixVente}</td>
            <td>${approv.benefice}</td>
            <td>
                <button class="delete-btn" onclick="supprimerOperation('approvisionnement', '${index}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function rafraichirTableauVentes() {
    const tbody = document.querySelector('#venteTable tbody');
    tbody.innerHTML = '';

    donnees.ventes.forEach((vente, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${vente.date}</td>
            <td>${vente.produit}</td>
            <td>${vente.quantite}</td>
            <td>${vente.prixVente}</td>
            <td>${vente.total}</td>
            <td>
                <button class="delete-btn" onclick="supprimerOperation('vente', '${index}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function rafraichirTableauInventaire() {
    const tbody = document.querySelector('#inventaireTable tbody');
    tbody.innerHTML = '';

    for (const [produit, info] of Object.entries(donnees.inventaire)) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${produit}</td>
            <td>${info.quantite}</td>
            <td>${info.valeur.toFixed(2)}</td> 
        `;
        tbody.appendChild(tr);
    }
}

// Mise à jour de la liste des produits
function mettreAJourSelectionProduits() {
    const selectApprov = document.getElementById('approvProduit');
    const selectVente = document.getElementById('venteProduit');

    selectApprov.innerHTML = '';
    selectVente.innerHTML = '';

    for (const produit in donnees.produits) {
        const optionApprov = document.createElement('option');
        optionApprov.value = produit;
        optionApprov.textContent = produit;
        selectApprov.appendChild(optionApprov);

        const optionVente = document.createElement('option');
        optionVente.value = produit;
        optionVente.textContent = produit;
        selectVente.appendChild(optionVente);
    }
}

// Fonction pour remplir le formulaire d'approvisionnement
function remplirFormulaireApprovisionnement(produit) {
    if (donnees.produits[produit]) {
        document.getElementById('approvPrixAchat').value = donnees.produits[produit].prixAchatDefaut || '';
        document.getElementById('approvPrixVente').value = donnees.produits[produit].prixVenteDefaut || '';
    } else {
        document.getElementById('approvPrixAchat').value = '';
        document.getElementById('approvPrixVente').value = '';
    }
}

// Fonctions pour le modal de gestion des produits
function ouvrirModalProduit() {
    document.getElementById("produitModal").style.display = "block";
}

function fermerModalProduit() {
    document.getElementById("produitModal").style.display = "none";
}

function ajouterProduit(event) {
    event.preventDefault();
    const nouveauProduit = document.getElementById('nouveauProduit').value;
    const prixAchatDefaut = parseFloat(document.getElementById('prixAchatDefaut').value) || null;
    const prixVenteDefaut = parseFloat(document.getElementById('prixVenteDefaut').value) || null;

    donnees.produits[nouveauProduit] = {
        prixAchatDefaut,
        prixVenteDefaut
    };

    sauvegarderDonnees();
    mettreAJourSelectionProduits();
    fermerModalProduit();
    event.target.reset();

    if (modeEnLigne) {
        database.ref('produits/' + nouveauProduit).set({
            prixAchatDefaut,
            prixVenteDefaut
        });
    }
}

// Modal pour la modification des approvisionnements/ventes
let editModal = document.getElementById('editModal');
let editForm = document.getElementById('editForm');
let editIdInput = document.getElementById('editId');
let editDateInput = document.getElementById('editDate');
let editProduitSelect = document.getElementById('editProduit');
let editQuantiteInput = document.getElementById('editQuantite');
let editPrixAchatInput = document.getElementById('editPrixAchat');
let editTransportInput = document.getElementById('editTransport');
let editPrixVenteInput = document.getElementById('editPrixVente');

function ouvrirModalEdit(type, index) {
    // Récupérer les données de l'opération à modifier
    let operation = type === 'approvisionnement' ? donnees.approvisionnements[index] : donnees.ventes[index];

    // Remplir le formulaire avec les données
    editIdInput.value = index;
    editIdInput.dataset.type = type; // Enregistrer le type de l'opération
    editDateInput.value = operation.date;
    editProduitSelect.value = operation.produit;
    editQuantiteInput.value = operation.quantite;
    editPrixAchatInput.value = operation.prixAchat;
    editTransportInput.value = operation.transport;
    editPrixVenteInput.value = operation.prixVente;

    // Remplir le sélecteur de produits
    remplirSelectProduits(editProduitSelect); // Important pour remplir le select avec les produits disponibles

    editModal.style.display = 'block';
}

function fermerModalEdit() {
    editModal.style.display = 'none';
    editForm.reset(); // Réinitialiser le formulaire
}

function modifierOperation(event) {
    event.preventDefault();
    const editId = parseInt(editIdInput.value);
    const type = editIdInput.dataset.type; // Récupérer le type de l'opération à modifier

    const date = editDateInput.value;
    const produit = editProduitSelect.value;
    const quantite = parseFloat(editQuantiteInput.value);
    const prixAchat = parseFloat(editPrixAchatInput.value);
    const transport = parseFloat(editTransportInput.value);
    const prixVente = parseFloat(editPrixVenteInput.value);

    const prixAchatTotal = prixAchat + transport;
    const benefice = (prixVente - prixAchatTotal) * quantite;

    const operationModifiee = {
        date,
        produit,
        quantite,
        prixAchat,
        transport,
        prixAchatTotal,
        prixVente,
        benefice
    };

    if (type === 'approvisionnement') {
        donnees.approvisionnements[editId] = operationModifiee;
        if (modeEnLigne) {
            database.ref('approvisionnements/' + editId).set(operationModifiee);
        }
    } else if (type === 'vente') {
        donnees.ventes[editId] = operationModifiee;
        if (modeEnLigne) {
            database.ref('ventes/' + editId).set(operationModifiee);
        }
    }

    mettreAJourInventaire();
    rafraichirTableaux();
    fermerModalEdit();
}

function supprimerOperation(type, index) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette opération ?")) {
        if (type === 'approvisionnement') {
            donnees.approvisionnements.splice(index, 1);
            if (modeEnLigne) {
                database.ref('approvisionnements/' + index).remove();
            }
        } else if (type === 'vente') {
            donnees.ventes.splice(index, 1);
            if (modeEnLigne) {
                database.ref('ventes/' + index).remove();
            }
        }
        mettreAJourInventaire();
        rafraichirTableaux();
    }
}

// Filtrage des données
function filtrerDonnees() {
    const dateDebut = document.getElementById('dateDebut').value;
    const dateFin = document.getElementById('dateFin').value;

    if (!dateDebut || !dateFin) return;

    const approvisionnementsFiltres = donnees.approvisionnements.filter(
        a => a.date >= dateDebut && a.date <= dateFin
    );

    const ventesFiltrees = donnees.ventes.filter(
        v => v.date >= dateDebut && v.date <= dateFin
    );

    // Afficher temporairement les données filtrées
    const donneesOriginales = { ...donnees };
    donnees.approvisionnements = approvisionnementsFiltres;
    donnees.ventes = ventesFiltrees;
    mettreAJourInventaire(); // Mettre à jour l'inventaire en fonction des données filtrées
    rafraichirTableaux();
    donnees = donneesOriginales;
}

function reinitialiserFiltres() {
    document.getElementById('dateDebut').value = '';
    document.getElementById('dateFin').value = '';
    rafraichirTableaux();
}

// Fonctions d'exportation
function exporterTableau(tableId, format) {
    const table = document.getElementById(tableId);

    if (format === 'pdf') {
        // Récupérer le titre du tableau en fonction de son ID
        let tableTitle = "Tableau"; // Titre par défaut
        switch (tableId) {
            case 'approvTable':
                tableTitle = "Tableau des Approvisionnements";
                break;
            case 'venteTable':
                tableTitle = "Tableau des Ventes";
                break;
            case 'inventaireTable':
                tableTitle = "Tableau des Inventaires";
                break;
        }

        // Utiliser html2canvas pour convertir le tableau en image
        html2canvas(table).then(canvas => {
            // Récupérer les données de l'image au format JPEG pour une meilleure compression
            const imgData = canvas.toDataURL('image/jpeg', 1.0);

            // Créer un nouvel objet jsPDF en format portrait ('p') et en unités 'mm'
            const doc = new jspdf.jsPDF('p', 'mm');

            // Définir les marges du document en mm
            const margin = 10;

            // Calculer la largeur de l'image pour qu'elle s'adapte aux marges
            const imgWidth = doc.internal.pageSize.getWidth() - 2 * margin;

            // Calculer la hauteur de l'image proportionnellement à sa largeur et à sa hauteur d'origine
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Ajouter le titre du tableau
            doc.setFontSize(16);
            doc.text(tableTitle, margin, 15); // Position du titre (x, y)

            // Ajouter l'image du tableau
            doc.addImage(imgData, 'JPEG', margin, 20, imgWidth, imgHeight);

            // Enregistrer le PDF
            doc.save(tableTitle + ".pdf");
        });
    } else if (format === 'excel') {
        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, tableId + ".xlsx");
    }
}

function imprimerTableau(tableId) {
    // Récupérer le titre du tableau en fonction de son ID
    let tableTitle = "Tableau"; // Titre par défaut
    switch (tableId) {
        case 'approvTable':
            tableTitle = "Tableau des Approvisionnements";
            break;
        case 'venteTable':
            tableTitle = "Tableau des Ventes";
            break;
        case 'inventaireTable':
            tableTitle = "Tableau des Inventaires";
            break;
    }

    // Cloner le tableau pour l'impression
    const tableToPrint = document.getElementById(tableId).cloneNode(true);

    // Supprimer les éléments non imprimables du clone
    const buttonsToRemove = tableToPrint.querySelectorAll('button');
    buttonsToRemove.forEach(button => button.remove());

    // Créer un nouvel élément iframe masqué
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Écrire le contenu HTML du tableau dans l'iframe
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
    <html>
    <head>
      <title>${tableTitle}</title>
      <style>
        /* Styles CSS pour l'impression */
        body {
          margin: 0; 
        }
        table {
            font-size: 10pt;
            width: 100%;
            border-collapse: collapse; 
            table-layout: fixed; 
        }

        th, td {
            border: 1px solid black;
            padding: 8px;
            word-wrap: break-word; 
        }

        /* Styles pour l'en-tête */
        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${tableTitle}</h1>
      </div>
      ${tableToPrint.outerHTML} 
    </body>
    </html>
  `);
    iframeDoc.close();

    // Attendre que l'iframe soit chargé avant de lancer l'impression
    iframe.onload = function () {
        iframe.contentWindow.focus(); // Focus sur l'iframe
        iframe.contentWindow.print(); // Imprimer depuis l'iframe
    };

    // Supprimer l'iframe après l'impression (facultatif)
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 0);
}

// Gestion du mode en ligne/hors ligne
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        modeEnLigne = this.value === 'online';
        localStorage.setItem('modeEnLigne', modeEnLigne);
        if (modeEnLigne) {
            synchroniserDonneesAvecFirebase();
        } 
    });
});

// Synchronisation des données avec Firebase (en mode en ligne)
function synchroniserDonneesAvecFirebase() {
    database.ref('approvisionnements').on('value', function(snapshot) {
        donnees.approvisionnements = [];
        snapshot.forEach(childSnapshot => {
            const approvisionnement = childSnapshot.val();
            donnees.approvisionnements.push(approvisionnement);
        });
        rafraichirTableauApprovisionnements();
        mettreAJourInventaire();
    });

    database.ref('ventes').on('value', function(snapshot) {
        donnees.ventes = [];
        snapshot.forEach(childSnapshot => {
            const vente = childSnapshot.val();
            donnees.ventes.push(vente);
        });
        rafraichirTableauVentes();
        mettreAJourInventaire();
    });

    database.ref('produits').on('value', function(snapshot) {
        donnees.produits = {};
        snapshot.forEach(childSnapshot => {
            const produit = childSnapshot.key;
            const data = childSnapshot.val();
            donnees.produits[produit] = data;
        });
        mettreAJourSelectionProduits();
    });
}

// Fonction pour remplir le sélecteur de produits dans le modal de modification
function remplirSelectProduits(selectElement) {
    selectElement.innerHTML = ''; // Effacer les options existantes
    for (const produit in donnees.produits) {
        const option = document.createElement('option');
        option.value = produit;
        option.textContent = produit;
        selectElement.appendChild(option);
    }
}

// Fonction pour rendre les boutons "Modifier" actifs au clic
function activerBoutonsModifier() {
    // Sélectionner tous les boutons "Modifier" dans les tableaux
    const boutonsModifier = document.querySelectorAll('.edit-btn');
    // Ajouter un écouteur d'événements "click" à chaque bouton
    boutonsModifier.forEach(bouton => {
        bouton.addEventListener('click', function() {
            // Obtenir l'index de l'opération à modifier (en utilisant data-index)
            const index = parseInt(this.dataset.index);
            // Obtenir le type de l'opération (approvisionnement ou vente)
            const type = this.dataset.type;
            // Appeler la fonction ouvrirModalEdit avec les informations
            ouvrirModalEdit(type, index);
        });
    });
}

// Appeler la fonction activerBoutonsModifier après le chargement de la page
window.onload = function() {
    chargerDonnees();
    mettreAJourSelectionProduits();
    document.getElementById('operationDate').valueAsDate = new Date();

    // Définir le mode hors ligne par défaut
    modeEnLigne = false; 
    document.getElementById('mode-offline').checked = true;

    activerBoutonsModifier(); 
};