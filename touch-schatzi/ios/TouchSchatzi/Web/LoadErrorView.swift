import UIKit

/// Shown when the bundled game fails to load or crashes on start-up. Branded to match the game
/// and offers a retry, so the player never gets stuck on a blank screen.
final class LoadErrorView: UIView {
    var onRetry: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = Theme.background
        accessibilityViewIsModal = true

        let title = UILabel()
        title.text = Strings.errorTitle
        title.font = Self.rounded(.title2, weight: .heavy)
        title.textColor = Theme.gold
        title.textAlignment = .center
        title.numberOfLines = 0
        title.adjustsFontForContentSizeCategory = true
        title.accessibilityTraits = .header

        let body = UILabel()
        body.text = Strings.errorBody
        body.font = Self.rounded(.body, weight: .medium)
        body.textColor = Theme.cream
        body.textAlignment = .center
        body.numberOfLines = 0
        body.adjustsFontForContentSizeCategory = true

        var config = UIButton.Configuration.filled()
        config.title = Strings.retry
        config.baseBackgroundColor = Theme.gold
        config.baseForegroundColor = Theme.brown
        config.cornerStyle = .capsule
        config.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 36, bottom: 14, trailing: 36)
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var attrs = attrs
            attrs.font = Self.rounded(.headline, weight: .heavy)
            return attrs
        }
        let button = UIButton(configuration: config, primaryAction: UIAction { [weak self] _ in self?.onRetry?() })
        button.accessibilityLabel = Strings.retry

        let stack = UIStackView(arrangedSubviews: [title, body, button])
        stack.axis = .vertical
        stack.spacing = 18
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: safeAreaLayoutGuide.centerYAnchor),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: safeAreaLayoutGuide.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: safeAreaLayoutGuide.trailingAnchor, constant: -28),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private static func rounded(_ style: UIFont.TextStyle, weight: UIFont.Weight) -> UIFont {
        let base = UIFont.preferredFont(forTextStyle: style)
        let descriptor = base.fontDescriptor.addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
            .withDesign(.rounded) ?? base.fontDescriptor
        return UIFont(descriptor: descriptor, size: base.pointSize)
    }
}
